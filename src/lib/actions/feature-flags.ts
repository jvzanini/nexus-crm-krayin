"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { setFlag, overrideFlag, clearOverride, listFlags } from "@/lib/flags/index";
import { logger } from "@/lib/logger";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

const setFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_:-]+$/),
  enabled: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
});

const overrideSchema = z.object({
  key: z.string().min(1),
  scope: z.enum(["company", "user"]),
  scopeId: z.string().uuid(),
  enabled: z.boolean(),
});

function handleError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, "flags.action.failed");
  return { success: false, error: fallback };
}

export async function listFlagsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listFlags>>>
> {
  try {
    await requirePermission("flags:manage");
    const flags = await listFlags();
    return { success: true, data: flags };
  } catch (err) {
    return handleError(err, "Erro ao listar feature flags");
  }
}

export async function setFlagAction(
  input: z.input<typeof setFlagSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("flags:manage");
    const parsed = setFlagSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const { key, ...patch } = parsed.data;
    await setFlag(key, patch, { userId: user.id });
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao salvar feature flag");
  }
}

export async function overrideFlagAction(
  input: z.input<typeof overrideSchema>,
): Promise<ActionResult> {
  try {
    await requirePermission("flags:manage");
    const parsed = overrideSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    await overrideFlag(parsed.data.key, parsed.data.scope, parsed.data.scopeId, parsed.data.enabled);
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao salvar override");
  }
}

export async function clearOverrideAction(
  key: string,
  scope: "company" | "user",
  scopeId: string,
): Promise<ActionResult> {
  try {
    await requirePermission("flags:manage");
    await clearOverride(key, scope, scopeId);
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao limpar override");
  }
}
