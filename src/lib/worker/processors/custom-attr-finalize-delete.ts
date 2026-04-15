import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  CUSTOM_ATTR_FINALIZE_DELETE_QUEUE,
  type FinalizeDeletePayload,
} from "../queues/custom-attr";

/**
 * STUB (T9.0) — implementação real virá em T11.5.
 */
export function startCustomAttrFinalizeDeleteWorker(): Worker {
  const worker = new Worker<FinalizeDeletePayload>(
    CUSTOM_ATTR_FINALIZE_DELETE_QUEUE,
    async (job: Job<FinalizeDeletePayload>) => {
      logger.warn(
        { jobId: job.id, data: job.data },
        "custom-attr.finalize-delete: processor stub (não implementado)",
      );
      throw new Error("custom-attr-finalize-delete: not implemented yet (T11.5)");
    },
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      "custom-attr.finalize-delete: job falhou",
    );
  });

  return worker;
}
