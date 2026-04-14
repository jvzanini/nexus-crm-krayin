import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { CampaignsListContent } from "./_components/campaigns-list-content";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "marketing:view")) redirect("/dashboard");

  const canManage = userHasPermission(user, "marketing:manage");
  const canSend = userHasPermission(user, "marketing:send");

  return <CampaignsListContent canManage={canManage} canSend={canSend} />;
}
