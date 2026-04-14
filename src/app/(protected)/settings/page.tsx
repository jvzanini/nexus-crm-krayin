import { redirect } from "next/navigation";
import type { PlatformRole } from "@nexusai360/types";
import { SettingsContent } from "@nexusai360/settings-ui";
import {
  toSettingsDTO,
  canEditSettings,
  canViewSettings,
} from "@nexusai360/settings-ui/server-helpers";
import { getCurrentUser } from "@/lib/auth";
import { settingsAdapter } from "@/lib/adapters/settings";
import { saveSettingAction } from "@/lib/actions/settings";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const role = user.platformRole as PlatformRole;
  if (!canViewSettings(role)) redirect("/dashboard");

  const raw = await settingsAdapter.getAllSettings();
  return (
    <SettingsContent
      initialSettings={toSettingsDTO(raw)}
      onSave={saveSettingAction}
      canEdit={canEditSettings(role)}
    />
  );
}
