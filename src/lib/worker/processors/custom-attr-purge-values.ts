import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  CUSTOM_ATTR_PURGE_VALUES_QUEUE,
  type PurgeValuesPayload,
} from "../queues/custom-attr";

/**
 * STUB (T9.0) — implementação real virá em T11.
 */
export function startCustomAttrPurgeValuesWorker(): Worker {
  const worker = new Worker<PurgeValuesPayload>(
    CUSTOM_ATTR_PURGE_VALUES_QUEUE,
    async (job: Job<PurgeValuesPayload>) => {
      logger.warn(
        { jobId: job.id, data: job.data },
        "custom-attr.purge-values: processor stub (não implementado)",
      );
      throw new Error("custom-attr-purge-values: not implemented yet (T11)");
    },
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
