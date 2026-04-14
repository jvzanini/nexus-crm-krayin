import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const MARKETING_SEND_QUEUE = "marketing-send";
export const marketingSendQueue = new Queue(MARKETING_SEND_QUEUE, { connection: redis });

export async function enqueueMarketingSend(recipientId: string): Promise<void> {
  await marketingSendQueue.add(
    "send-one",
    { recipientId },
    {
      jobId: `mk-${recipientId}`,
      priority: 10,
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  );
}
