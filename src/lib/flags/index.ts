import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { resolveFlag, type FlagRecord, type FlagOverrideRecord, type ResolveContext } from "./resolve";

const CACHE_PREFIX = "flag:v1:";
const CACHE_TTL = 60; // segundos

interface CachedEntry {
  flag: FlagRecord | null;
  overrides: FlagOverrideRecord[];
}

async function fromCache(key: string): Promise<CachedEntry | null> {
  try {
    const raw = await redis.get(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedEntry;
  } catch (err) {
    logger.warn({ err, key }, "flags.cache.read_failed");
    return null;
  }
}

async function writeCache(key: string, entry: CachedEntry): Promise<void> {
  try {
    await redis.set(CACHE_PREFIX + key, JSON.stringify(entry), "EX", CACHE_TTL);
  } catch (err) {
    logger.warn({ err, key }, "flags.cache.write_failed");
  }
}

async function loadEntry(key: string): Promise<CachedEntry> {
  const cached = await fromCache(key);
  if (cached) return cached;

  const [flag, overrides] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key } }),
    prisma.featureFlagOverride.findMany({ where: { key } }),
  ]);

  const entry: CachedEntry = {
    flag: flag
      ? { key: flag.key, enabled: flag.enabled, rolloutPct: flag.rolloutPct }
      : null,
    overrides: overrides.map((o) => ({
      key: o.key,
      scope: o.scope as "company" | "user",
      scopeId: o.scopeId,
      enabled: o.enabled,
    })),
  };
  await writeCache(key, entry);
  return entry;
}

export async function invalidateFlag(key: string): Promise<void> {
  try {
    await redis.del(CACHE_PREFIX + key);
  } catch (err) {
    logger.warn({ err, key }, "flags.cache.invalidate_failed");
  }
}

export async function getFlag(
  key: string,
  ctx: ResolveContext = {},
): Promise<boolean> {
  try {
    const entry = await loadEntry(key);
    return resolveFlag(key, entry.flag, entry.overrides, ctx);
  } catch (err) {
    logger.error({ err, key }, "flags.resolve_failed");
    return false; // conservative default
  }
}

export async function listFlags() {
  return prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
    include: { overrides: true },
  });
}

export async function setFlag(
  key: string,
  patch: { enabled?: boolean; rolloutPct?: number; description?: string },
  actor: { userId: string },
): Promise<void> {
  if (patch.rolloutPct !== undefined) {
    if (patch.rolloutPct < 0 || patch.rolloutPct > 100) {
      throw new Error("rolloutPct deve estar entre 0 e 100");
    }
  }

  await prisma.featureFlag.upsert({
    where: { key },
    create: {
      key,
      enabled: patch.enabled ?? false,
      rolloutPct: patch.rolloutPct ?? 0,
      description: patch.description,
      updatedBy: actor.userId,
    },
    update: {
      ...(patch.enabled !== undefined && { enabled: patch.enabled }),
      ...(patch.rolloutPct !== undefined && { rolloutPct: patch.rolloutPct }),
      ...(patch.description !== undefined && { description: patch.description }),
      updatedBy: actor.userId,
    },
  });
  await invalidateFlag(key);
  logger.info({ key, patch, actor: actor.userId }, "flags.set");
}

export async function overrideFlag(
  key: string,
  scope: "company" | "user",
  scopeId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.featureFlagOverride.upsert({
    where: { key_scope_scopeId: { key, scope, scopeId } },
    create: { key, scope, scopeId, enabled },
    update: { enabled },
  });
  await invalidateFlag(key);
}

export async function clearOverride(
  key: string,
  scope: "company" | "user",
  scopeId: string,
): Promise<void> {
  await prisma.featureFlagOverride.deleteMany({
    where: { key, scope, scopeId },
  });
  await invalidateFlag(key);
}

export type { FlagRecord, FlagOverrideRecord, ResolveContext } from "./resolve";

// Env-driven constants (migrado de src/lib/flags.ts em Fase 35 F1.3)
export const DS_V3_ENABLED = process.env.DS_V3_ENABLED !== "false";
export const DS_PREVIEW = process.env.DS_PREVIEW === "true";
