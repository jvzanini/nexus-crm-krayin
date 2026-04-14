import { redirect } from "next/navigation";
import { FlagsContent } from "@nexusai360/settings-ui";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
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
  // Check via RBAC do CRM (vendor @nexusai360/settings-ui/server-helpers
  // tem matriz default separada que não inclui flags:manage em admin).
  if (!userHasPermission(user, "flags:manage")) redirect("/dashboard");

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
