import { inRollout } from "./rollout";

export interface FlagRecord {
  key: string;
  enabled: boolean;
  rolloutPct: number;
}

export interface FlagOverrideRecord {
  key: string;
  scope: "company" | "user";
  scopeId: string;
  enabled: boolean;
}

export interface ResolveContext {
  userId?: string | null;
  companyId?: string | null;
}

/**
 * Resolução de feature flag (pura; sem I/O).
 *
 * Ordem (primeiro match vence):
 * 1. override user — se houver, usa `enabled` dele.
 * 2. override company — idem.
 * 3. rolloutPct via hash(key:userId) — só quando userId está presente.
 * 4. `enabled` global da flag.
 * 5. default: false.
 */
export function resolveFlag(
  key: string,
  flag: FlagRecord | null,
  overrides: readonly FlagOverrideRecord[],
  ctx: ResolveContext,
): boolean {
  if (!flag) return false;

  if (ctx.userId) {
    const ov = overrides.find(
      (o) => o.scope === "user" && o.scopeId === ctx.userId && o.key === key,
    );
    if (ov) return ov.enabled;
  }

  if (ctx.companyId) {
    const ov = overrides.find(
      (o) => o.scope === "company" && o.scopeId === ctx.companyId && o.key === key,
    );
    if (ov) return ov.enabled;
  }

  if (flag.rolloutPct > 0 && ctx.userId) {
    return inRollout(key, ctx.userId, flag.rolloutPct);
  }

  return Boolean(flag.enabled);
}
