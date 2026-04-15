import { z } from "zod";

/**
 * Registry canônico dos 8 eventos de audit emitidos pelo módulo Data
 * Transfer (Fase 10). Cada entrada expõe o `Zod` schema do payload
 * `details` para validação centralizada.
 *
 * Ver spec v3 §3.11.
 */

const uuid = z.string().uuid();
const entity = z.enum(["lead", "contact", "opportunity", "product"]);
const format = z.enum(["csv", "xlsx"]);
const mode = z.enum(["strict", "lenient"]);

export const dataTransferEvents = {
  "data_transfer.import.uploaded": z.object({
    jobId: uuid,
    entity,
    filename: z.string().max(255),
    sizeBytes: z.number().int().nonnegative(),
    fileHash: z.string().min(1).max(128),
  }),
  "data_transfer.import.previewed": z.object({
    jobId: uuid,
    validCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    mode,
  }),
  "data_transfer.import.committed": z.object({
    jobId: uuid,
    rowCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    async: z.boolean(),
  }),
  "data_transfer.import.rolled_back": z.object({
    jobId: uuid,
    rowCountRemoved: z.number().int().nonnegative(),
    reason: z.string().max(255),
  }),
  "data_transfer.import.cancelled": z.object({
    jobId: uuid,
    reason: z.string().max(255),
  }),
  "data_transfer.export.generated": z.object({
    jobId: uuid,
    entity,
    format,
    rowCount: z.number().int().nonnegative(),
    columnCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  }),
  "data_transfer.export.downloaded": z.object({
    jobId: uuid.optional(),
    actorIp: z.string().max(64).optional(),
    userAgent: z.string().max(512).optional(),
  }),
  "data_transfer.history.purged": z.object({
    removedJobs: z.number().int().nonnegative(),
    cutoffDate: z.string(),
  }),
} as const;

export type DataTransferAction = keyof typeof dataTransferEvents;

export type DataTransferPayload<A extends DataTransferAction> = z.infer<
  (typeof dataTransferEvents)[A]
>;

/**
 * Valida payload contra o schema do event. Lança erro descritivo se
 * payload inválido — use em testes / dev asserts. Em produção, o
 * persist já tolera `details: Record<string, unknown>`.
 */
export function assertDataTransferPayload<A extends DataTransferAction>(
  action: A,
  payload: unknown,
): DataTransferPayload<A> {
  const schema = dataTransferEvents[action];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `audit ${action} payload inválido: ${parsed.error.message}`,
    );
  }
  return parsed.data as DataTransferPayload<A>;
}
