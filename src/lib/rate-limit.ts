import { redis } from "@/lib/redis";

const WINDOW_SECONDS = 60;
const LOCKOUT_TIERS = [
  { maxAttempts: 5, lockoutSeconds: 900 },   // 5 tentativas → 15min
  { maxAttempts: 10, lockoutSeconds: 3600 },  // 10 tentativas → 1h
  { maxAttempts: 20, lockoutSeconds: 86400 }, // 20 tentativas → 24h
];

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

function getKey(prefix: string, email: string, ip: string) {
  return `${prefix}:${email}:${ip}`;
}

export async function checkLoginRateLimit(
  email: string,
  ip: string
): Promise<RateLimitResult> {
  const lockoutKey = getKey("lockout", email, ip);
  const countKey = getKey("attempts", email, ip);

  // Verificar lockout ativo
  const lockoutTtl = await redis.ttl(lockoutKey);
  if (lockoutTtl > 0) {
    return { allowed: false, remaining: 0, retryAfterSeconds: lockoutTtl };
  }

  // Contar tentativas na janela
  const count = parseInt((await redis.get(countKey)) || "0", 10);

  // Incrementar contador
  const newCount = await redis.incr(countKey);
  if (newCount === 1) {
    await redis.expire(countKey, WINDOW_SECONDS);
  }

  // Verificar tiers de lockout
  for (const tier of LOCKOUT_TIERS.slice().reverse()) {
    if (newCount >= tier.maxAttempts) {
      await redis.set(lockoutKey, "1", "EX", tier.lockoutSeconds);
      return { allowed: false, remaining: 0, retryAfterSeconds: tier.lockoutSeconds };
    }
  }

  const maxAllowed = LOCKOUT_TIERS[0].maxAttempts;
  return { allowed: true, remaining: Math.max(0, maxAllowed - newCount) };
}

export async function clearLoginRateLimit(email: string, ip: string): Promise<void> {
  const lockoutKey = getKey("lockout", email, ip);
  const countKey = getKey("attempts", email, ip);
  await redis.del(lockoutKey, countKey);
}
