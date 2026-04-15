import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  CUSTOM_ATTR_PURGE_VALUES_QUEUE,
  dropIndexQueue,
  finalizeDeleteQueue,
  type PurgeValuesPayload,
} from "../queues/custom-attr";

/**
 * T11/34 — Custom Attributes: processor purge-values.
 *
 * Spec v3 §3.8 + Plan v3 CR-3:
 * - Loop de UPDATE sem OFFSET (idempotente; cada batch remove até 500 rows
 *   que ainda possuem a chave; quando affected===0, acabou).
 * - Retomada pós-crash: reexecutar o mesmo job após progresso parcial
 *   simplesmente continua de onde parou (sem perder/duplicar trabalho).
 * - `$executeRaw` retorna `number` (affected rows).
 * - KEY_REGEX + ALLOWED_TABLES bloqueiam SQL injection via interpolação.
 * - Chain: `indexHandoff=true` → dropIndexQueue; caso contrário
 *   → finalizeDeleteQueue (jobIds determinísticos garantem idempotência).
 */

const KEY_REGEX = /^[a-z][a-z0-9_]{1,79}$/;
const ALLOWED_TABLES = new Set(["leads", "contacts", "opportunities"] as const);
const ENTITY_TABLE: Record<string, string> = {
  lead: "leads",
  contact: "contacts",
  opportunity: "opportunities",
};

const BATCH_SIZE = 500;

export async function processPurgeValues(
  job: Job<PurgeValuesPayload>,
): Promise<{ totalPurged: number }> {
  const { entity, key, companyId, defId, indexHandoff } = job.data;

  if (!KEY_REGEX.test(key)) {
    throw new Error(`invalid key: ${key}`);
  }

  const tableName = ENTITY_TABLE[entity];
  if (!tableName || !ALLOWED_TABLES.has(tableName as "leads" | "contacts" | "opportunities")) {
    throw new Error(`invalid entity: ${entity}`);
  }

  let totalPurged = 0;

  // tableName é seguro (whitelisted via ALLOWED_TABLES); key validada por KEY_REGEX.
  // Valores dinâmicos (companyId, key, limit) passam como parâmetros $1..$3.
  const sql = `
    UPDATE ${tableName}
    SET custom = custom - $2
    WHERE id IN (
      SELECT id FROM ${tableName}
      WHERE company_id = $1::uuid AND custom ? $2
      LIMIT $3
    )
  `;

  // Loop sem OFFSET: cada iteração remove até BATCH_SIZE linhas com a chave.
  // Quando affected===0, não há mais linhas a purgar.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const affected: number = await prisma.$executeRawUnsafe(
      sql,
      companyId,
      key,
      BATCH_SIZE,
    );

    if (affected === 0) break;

    totalPurged += affected;
    await job.updateProgress({ purged: totalPurged });
  }

  // Chain — jobId determinístico evita duplicação em retries.
  if (indexHandoff) {
    await dropIndexQueue.add(
      `drop-${entity}-${key}`,
      { entity, key, defId },
      { jobId: `di:${entity}:${key}` },
    );
  } else {
    await finalizeDeleteQueue.add(
      `finalize-${defId}`,
      { defId },
      { jobId: `fd:${defId}` },
    );
  }

  return { totalPurged };
}

export function startCustomAttrPurgeValuesWorker(): Worker {
  const worker = new Worker<PurgeValuesPayload>(
    CUSTOM_ATTR_PURGE_VALUES_QUEUE,
    async (job: Job<PurgeValuesPayload>) => processPurgeValues(job),
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      "custom-attr.purge-values: job falhou",
    );
  });

  return worker;
}
