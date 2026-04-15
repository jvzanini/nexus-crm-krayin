import { Worker, type Job } from "bullmq";
import { Client } from "pg";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  CUSTOM_ATTR_DROP_INDEX_QUEUE,
  finalizeDeleteQueue,
  type DropIndexPayload,
} from "../queues/custom-attr";

const KEY_REGEX = /^[a-z][a-z0-9_]{1,79}$/;
const ALLOWED_ENTITIES = new Set(["lead", "contact", "opportunity"]);

/**
 * T10 — drop-unique-index processor.
 *
 * Fluxo (Spec v3 §3.3):
 *   - refCount > 1  → decrementa e NÃO dropa (index continua compartilhado).
 *   - refCount == 1 → DROP INDEX CONCURRENTLY IF EXISTS + deleta ref row.
 *   - ref missing   → warn + no-op (idempotente para reruns).
 * Em todos os casos: enqueue finalize-delete-def job (CR-1).
 */
export async function processDropIndex(
  job: Job<DropIndexPayload>,
): Promise<{ dropped: boolean; refCount: number }> {
  const { entity, key, defId } = job.data;

  if (!KEY_REGEX.test(key)) {
    throw new Error(`invalid key: ${key}`);
  }
  if (!ALLOWED_ENTITIES.has(entity)) {
    throw new Error(`invalid entity: ${entity}`);
  }

  const ref = await prisma.customAttributeUniqueRef.findUnique({
    where: { entity_key: { entity: entity as any, key } },
  });

  const finalizeJobName = `finalize-${defId}`;
  const finalizeOpts = { jobId: `fd:${defId}` };

  if (!ref) {
    logger.warn(
      { entity, key, defId },
      "custom-attr.drop-index: ref não encontrada (no-op idempotente)",
    );
    await finalizeDeleteQueue.add(finalizeJobName, { defId }, finalizeOpts);
    return { dropped: false, refCount: 0 };
  }

  if (ref.refCount > 1) {
    await prisma.customAttributeUniqueRef.update({
      where: { id: ref.id },
      data: { refCount: { decrement: 1 } },
    });
    logger.info(
      { entity, key, defId, refCount: ref.refCount - 1 },
      "custom-attr.drop-index: refCount decrementado, index mantido",
    );
    await finalizeDeleteQueue.add(finalizeJobName, { defId }, finalizeOpts);
    return { dropped: false, refCount: ref.refCount - 1 };
  }

  // refCount === 1 → dropar via pg direto (CONCURRENTLY não roda em tx).
  const directUrl = process.env.DIRECT_URL;
  const connectionString = directUrl ?? process.env.DATABASE_URL;
  if (!directUrl) {
    logger.warn(
      "custom-attr.drop-index: DIRECT_URL ausente, usando DATABASE_URL como fallback",
    );
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "${ref.indexName}"`,
    );
    await prisma.customAttributeUniqueRef.delete({ where: { id: ref.id } });
    logger.info(
      { entity, key, defId, indexName: ref.indexName },
      "custom-attr.drop-index: index dropado + ref deletada",
    );
  } finally {
    await client.end();
  }

  await finalizeDeleteQueue.add(finalizeJobName, { defId }, finalizeOpts);
  return { dropped: true, refCount: 0 };
}

/**
 * Registra o worker BullMQ para a fila drop-index.
 */
export function startCustomAttrDropIndexWorker(): Worker {
  const worker = new Worker<DropIndexPayload>(
    CUSTOM_ATTR_DROP_INDEX_QUEUE,
    async (job: Job<DropIndexPayload>) => processDropIndex(job),
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      "custom-attr.drop-index: job falhou",
    );
  });

  return worker;
}
