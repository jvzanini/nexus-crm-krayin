// Queue — BullMQ producer helpers
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

// Conexão compartilhada BullMQ (usa instância IORedis do redis.ts)
const connection = redis;

export const emailQueue = new Queue("email", { connection });
export const outboxQueue = new Queue("outbox", { connection });

export type EmailJobData = {
  to: string;
  subject: string;
  html: string;
};

export type OutboxJobData = {
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

/**
 * Enfileira um e-mail para envio assíncrono.
 */
export async function enqueueEmail(data: EmailJobData) {
  await emailQueue.add("send-email", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}

/**
 * Enfileira um evento de outbox para processamento assíncrono.
 */
export async function enqueueOutboxEvent(data: OutboxJobData) {
  await outboxQueue.add("process-outbox", data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  });
}
