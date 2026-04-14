import { randomBytes } from "node:crypto";
import { redis } from "@/lib/redis";

const STATE_PREFIX = "oauth:state:";
const TTL_SECONDS = 600;

export async function saveOAuthState(userId: string): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  await redis.set(`${STATE_PREFIX}${nonce}`, userId, "EX", TTL_SECONDS);
  return nonce;
}

export async function consumeOAuthState(nonce: string): Promise<string | null> {
  const key = `${STATE_PREFIX}${nonce}`;
  const userId = await redis.get(key);
  if (userId) await redis.del(key);
  return userId;
}
