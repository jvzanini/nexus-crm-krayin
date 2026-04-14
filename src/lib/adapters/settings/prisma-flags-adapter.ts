import type {
  Flag,
  FlagsAdapter,
  SetFlagInput,
  SetOverrideInput,
} from "@nexusai360/settings-ui/server-helpers";
import {
  listFlags,
  setFlag,
  overrideFlag,
  clearOverride,
} from "@/lib/flags/index";

export class PrismaFlagsAdapter implements FlagsAdapter {
  async list(): Promise<Flag[]> {
    const rows = await listFlags();
    return rows.map((r) => ({
      key: r.key,
      description: r.description,
      enabled: r.enabled,
      rolloutPct: r.rolloutPct,
      updatedAt: r.updatedAt,
      overrides: r.overrides.map((o) => ({
        scope: o.scope as "company" | "user",
        scopeId: o.scopeId,
        enabled: o.enabled,
      })),
    }));
  }

  async set(input: SetFlagInput, updatedBy: string): Promise<void> {
    const { key, ...patch } = input;
    await setFlag(key, patch, { userId: updatedBy });
  }

  async setOverride(input: SetOverrideInput): Promise<void> {
    await overrideFlag(input.key, input.scope, input.scopeId, input.enabled);
  }

  async clearOverride(
    key: string,
    scope: "company" | "user",
    scopeId: string,
  ): Promise<void> {
    await clearOverride(key, scope, scopeId);
  }
}
