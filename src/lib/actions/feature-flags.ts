"use server";

import { revalidatePath } from "next/cache";
import type { PlatformRole } from "@nexusai360/types";
import type {
  ActionResult,
  SetFlagInput,
  SetOverrideInput,
} from "@nexusai360/settings-ui/server-helpers";
import {
  setFlagSchema,
  overrideFlagSchema,
  canManageFlags,
} from "@nexusai360/settings-ui/server-helpers";
import { getCurrentUser } from "@/lib/auth";
import { flagsAdapter } from "@/lib/adapters/settings";
import { logger } from "@/lib/logger";

async function requireFlagsManage() {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" as const, user: null };
  if (!canManageFlags(user.platformRole as PlatformRole)) {
    return { error: "forbidden" as const, user: null };
  }
  return { error: null, user };
}

export async function setFlagAction(
  input: SetFlagInput,
): Promise<ActionResult> {
  try {
    const parsed = setFlagSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
      };
    }
    const { error, user } = await requireFlagsManage();
    if (error) return { success: false, error };
    await flagsAdapter.set(parsed.data, user.id);
    revalidatePath("/settings/flags");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "flags.set.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function overrideFlagAction(
  input: SetOverrideInput,
): Promise<ActionResult> {
  try {
    const parsed = overrideFlagSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
      };
    }
    const { error } = await requireFlagsManage();
    if (error) return { success: false, error };
    await flagsAdapter.setOverride(parsed.data);
    revalidatePath("/settings/flags");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "flags.override.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function clearOverrideAction(
  key: string,
  scope: "company" | "user",
  scopeId: string,
): Promise<ActionResult> {
  try {
    const { error } = await requireFlagsManage();
    if (error) return { success: false, error };
    await flagsAdapter.clearOverride(key, scope, scopeId);
    revalidatePath("/settings/flags");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "flags.clear_override.failed");
    return { success: false, error: "internal_error" };
  }
}
