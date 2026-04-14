import { redirect } from "next/navigation";
import type { PlatformRole } from "@nexusai360/types";
import { FlagsContent } from "@nexusai360/settings-ui";
import { canManageFlags } from "@nexusai360/settings-ui/server-helpers";
import { getCurrentUser } from "@/lib/auth";
import { flagsAdapter } from "@/lib/adapters/settings";
import {
  setFlagAction,
  overrideFlagAction,
  clearOverrideAction,
} from "@/lib/actions/feature-flags";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const role = user.platformRole as PlatformRole;
  if (!canManageFlags(role)) redirect("/dashboard");

  const initialFlags = await flagsAdapter.list();
  return (
    <FlagsContent
      initialFlags={initialFlags}
      onSetFlag={setFlagAction}
      onSetOverride={overrideFlagAction}
      onClearOverride={clearOverrideAction}
      canManage
    />
  );
}
