import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
  CUSTOM_ATTR_DROP_INDEX_QUEUE,
  type DropIndexPayload,
} from "../queues/custom-attr";

/**
 * STUB (T9.0) — implementação real virá em T10.
 */
export function startCustomAttrDropIndexWorker(): Worker {
  const worker = new Worker<DropIndexPayload>(
    CUSTOM_ATTR_DROP_INDEX_QUEUE,
    async (job: Job<DropIndexPayload>) => {
      logger.warn(
        { jobId: job.id, data: job.data },
        "custom-attr.drop-index: processor stub (não implementado)",
      );
      throw new Error("custom-attr-drop-index: not implemented yet (T10)");
    },
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
