"use server";

import { revalidatePath } from "next/cache";
import type { PlatformRole } from "@nexusai360/types";
import type {
  ActionResult,
  SetSettingInput,
} from "@nexusai360/settings-ui/server-helpers";
import {
  setSettingSchema,
  canEditSettings,
} from "@nexusai360/settings-ui/server-helpers";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { settingsAdapter } from "@/lib/adapters/settings";
import { logger } from "@/lib/logger";

export async function saveSettingAction(
  input: SetSettingInput,
): Promise<ActionResult> {
  try {
    const parsed = setSettingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
      };
    }
    const user = await requirePermission("settings:edit");
    if (!canEditSettings(user.platformRole as PlatformRole)) {
      return { success: false, error: "forbidden" };
    }
    await settingsAdapter.setSetting(
      parsed.data.key,
      parsed.data.value,
      user.id,
    );
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    logger.error({ err }, "settings.save.failed");
    return { success: false, error: "internal_error" };
  }
}
