import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  CUSTOM_ATTR_CREATE_INDEX_QUEUE,
  type CreateIndexPayload,
} from "../queues/custom-attr";

/**
 * STUB (T9.0) — implementação real virá em T9.
 * Por ora, apenas registra o processor e lança erro para sinalizar não-implementação
 * caso algum job seja consumido antes da lógica real.
 */
export function startCustomAttrCreateIndexWorker(): Worker {
  const worker = new Worker<CreateIndexPayload>(
    CUSTOM_ATTR_CREATE_INDEX_QUEUE,
    async (job: Job<CreateIndexPayload>) => {
      logger.warn(
        { jobId: job.id, data: job.data },
        "custom-attr.create-index: processor stub (não implementado)",
      );
      throw new Error("custom-attr-create-index: not implemented yet (T9)");
    },
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
