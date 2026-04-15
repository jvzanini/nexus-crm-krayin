import { Queue, JobsOptions } from "bullmq";
import { redis } from "@/lib/redis";

// ============================================================
// Nomes das filas (T9.0 — Custom Attributes async pipeline)
// ============================================================

export const CUSTOM_ATTR_CREATE_INDEX_QUEUE = "custom-attr-create-index";
export const CUSTOM_ATTR_DROP_INDEX_QUEUE = "custom-attr-drop-index";
export const CUSTOM_ATTR_PURGE_VALUES_QUEUE = "custom-attr-purge-values";
export const CUSTOM_ATTR_FINALIZE_DELETE_QUEUE = "custom-attr-finalize-delete";

// ============================================================
// Payloads
// ============================================================

export interface CreateIndexPayload {
  entity: string;
  key: string;
  defId: string;
}

export interface DropIndexPayload {
  entity: string;
  key: string;
  defId: string;
}

export interface PurgeValuesPayload {
  entity: string;
  key: string;
  companyId: string;
  defId: string;
  indexHandoff: boolean;
}

export interface FinalizeDeletePayload {
  defId: string;
}

// ============================================================
// Queues
// ============================================================

export const createIndexQueue = new Queue<CreateIndexPayload>(
  CUSTOM_ATTR_CREATE_INDEX_QUEUE,
  { connection: redis },
);

export const dropIndexQueue = new Queue<DropIndexPayload>(
  CUSTOM_ATTR_DROP_INDEX_QUEUE,
  { connection: redis },
);

export const purgeValuesQueue = new Queue<PurgeValuesPayload>(
  CUSTOM_ATTR_PURGE_VALUES_QUEUE,
  { connection: redis },
);

export const finalizeDeleteQueue = new Queue<FinalizeDeletePayload>(
  CUSTOM_ATTR_FINALIZE_DELETE_QUEUE,
  { connection: redis },
);

// ============================================================
// Enqueue helpers (idempotency keys)
// ============================================================

const baseOpts: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: 1000,
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
};

export async function enqueueCreateIndex(data: CreateIndexPayload): Promise<string | null> {
  const jobId = `ci:${data.entity}:${data.key}`;
  const job = await createIndexQueue.add("create-index", data, { ...baseOpts, jobId });
  return job.id ?? null;
}

export async function enqueueDropIndex(data: DropIndexPayload): Promise<string | null> {
  const jobId = `di:${data.entity}:${data.key}`;
  const job = await dropIndexQueue.add("drop-index", data, { ...baseOpts, jobId });
  return job.id ?? null;
}

export async function enqueuePurgeValues(data: PurgeValuesPayload): Promise<string | null> {
  const jobId = `purge:${data.entity}:${data.key}:${data.companyId}`;
  const job = await purgeValuesQueue.add("purge-values", data, { ...baseOpts, jobId });
  return job.id ?? null;
}

export async function enqueueFinalizeDelete(data: FinalizeDeletePayload): Promise<string | null> {
  const jobId = `fd:${data.defId}`;
  const job = await finalizeDeleteQueue.add("finalize-delete", data, { ...baseOpts, jobId });
  return job.id ?? null;
}
