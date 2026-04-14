import {
  checkRateLimit,
  recordAttempt,
  applyProgressiveLockout,
  resetAttempts,
  DEFAULT_LOCKOUT_TIERS,
} from "@nexusai360/core";

const WINDOW_MS = 60_000;
const FIRST_TIER_MAX = DEFAULT_LOCKOUT_TIERS[0].maxAttempts; // 5

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

function getKey(email: string, ip: string): string {
  return `${email}:${ip}`;
}

export async function checkLoginRateLimit(
  email: string,
  ip: string,
): Promise<RateLimitResult> {
  const key = getKey(email, ip);
  // 1. Verifica lockout ativo (sem incrementar)
  const pre = await checkRateLimit(key, FIRST_TIER_MAX, WINDOW_MS);
  if (!pre.allowed) {
    return { allowed: false, remaining: 0, retryAfterSeconds: pre.retryAfter };
  }
  // 2. Incrementa atomicamente (INCR + PEXPIRE)
  const newCount = await recordAttempt(key, WINDOW_MS);
  // 3. Aplica tier progressivo se threshold atingido
  const lock = await applyProgressiveLockout(
    key,
    newCount,
    DEFAULT_LOCKOUT_TIERS,
  );
  if (lock.tier) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: lock.tier.lockoutSeconds,
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, FIRST_TIER_MAX - newCount),
  };
}

export async function clearLoginRateLimit(
  email: string,
  ip: string,
): Promise<void> {
  await resetAttempts(getKey(email, ip));
}
