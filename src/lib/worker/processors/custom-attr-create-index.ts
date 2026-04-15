import { Worker, type Job } from "bullmq";
import { Client } from "pg";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildUniqueIndexName } from "@/lib/custom-attributes/index-naming";
import {
  CUSTOM_ATTR_CREATE_INDEX_QUEUE,
  type CreateIndexPayload,
} from "../queues/custom-attr";

/**
 * Fase 5 — Custom Attributes: processor `custom-attr-create-index` (T9/34).
 * Spec v3 §3.3 + Plan v3 CR-3.
 *
 * Cria um unique partial index compartilhado por (entity, key) sobre a coluna
 * JSONB `custom`, escopado por `company_id`, de forma idempotente:
 *   - Mantém uma ref-count via `CustomAttributeUniqueRef` (unique em entity+key).
 *   - Se ref existe, apenas incrementa refCount (nada no pg).
 *   - Senão, consulta `pg_indexes` e só chama `CREATE UNIQUE INDEX CONCURRENTLY`
 *     se o index não existir. Em seguida, persiste a ref com refCount=1.
 *
 * CR-3: valida chave via KEY_REGEX e entidade via ALLOWED_ENTITIES para
 * evitar SQL injection (tableName é mapeado, não interpolado).
 *
 * Usa `DIRECT_URL` (bypass de pgBouncer, exigido para `CREATE INDEX CONCURRENTLY`).
 * Se ausente, cai para `DATABASE_URL` e emite warn.
 */

const KEY_REGEX = /^[a-z][a-z0-9_]{1,79}$/;
const ALLOWED_ENTITIES = new Set(["lead", "contact", "opportunity"] as const);
const ENTITY_TO_TABLE = {
  lead: "leads",
  contact: "contacts",
  opportunity: "opportunities",
} as const;

type AllowedEntity = keyof typeof ENTITY_TO_TABLE;

export async function processCreateIndex(
  job: Job<CreateIndexPayload>,
): Promise<{ created: boolean; refCount: number }> {
  const { entity, key } = job.data;

  if (!KEY_REGEX.test(key)) {
    throw new Error(`custom-attr.create-index: invalid key: ${key}`);
  }
  if (!ALLOWED_ENTITIES.has(entity as AllowedEntity)) {
    throw new Error(`custom-attr.create-index: invalid entity: ${entity}`);
  }

  const tableName = ENTITY_TO_TABLE[entity as AllowedEntity];
  const indexName = buildUniqueIndexName(entity, key);

  const existing = await prisma.customAttributeUniqueRef.findUnique({
    where: { entity_key: { entity: entity as AllowedEntity, key } },
  });
  if (existing) {
    await prisma.customAttributeUniqueRef.update({
      where: { id: existing.id },
      data: { refCount: { increment: 1 } },
    });
    return { created: false, refCount: existing.refCount + 1 };
  }

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!process.env.DIRECT_URL) {
    logger.warn(
      { jobId: job.id, entity, key },
      "custom-attr.create-index: using DATABASE_URL fallback (DIRECT_URL not set)",
    );
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = $1`,
      [indexName],
    );
    if (!rowCount) {
      // tableName é valor mapeado (não interpolação de user input); indexName é
      // determinístico a partir de entity+key (ambos já validados via regex/set).
      await client.query(
        `CREATE UNIQUE INDEX CONCURRENTLY "${indexName}" ON ${tableName} ((custom->>$1), company_id) WHERE custom ? $1`,
        [key],
      );
    }
    await prisma.customAttributeUniqueRef.create({
      data: {
        entity: entity as AllowedEntity,
        key,
        refCount: 1,
        indexName,
      },
    });
  } finally {
    await client.end();
  }

  return { created: true, refCount: 1 };
}

export function startCustomAttrCreateIndexWorker(): Worker {
  const worker = new Worker<CreateIndexPayload>(
    CUSTOM_ATTR_CREATE_INDEX_QUEUE,
    async (job: Job<CreateIndexPayload>) => processCreateIndex(job),
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      "custom-attr.create-index: job falhou",
    );
  });

  return worker;
}
