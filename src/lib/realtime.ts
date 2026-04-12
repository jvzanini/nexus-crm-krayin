// Realtime SSE via Redis Pub/Sub
import { redis } from "@/lib/redis";

export const REALTIME_CHANNEL = "nexus:realtime";

export type RealtimeEvent = {
  type: string;
  payload: Record<string, unknown>;
  userId?: string;
  companyId?: string;
};

/**
 * Publica um evento realtime no canal Redis.
 */
export async function publishEvent(event: RealtimeEvent): Promise<void> {
  await redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
}
