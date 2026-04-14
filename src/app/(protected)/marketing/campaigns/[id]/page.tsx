import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { getCampaignAction, getCampaignStatsAction } from "@/lib/actions/marketing-campaigns";
import { CampaignDetailContent } from "../_components/campaign-detail-content";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "marketing:view")) redirect("/dashboard");

  const { id } = await params;

  const [campaignResult, statsResult] = await Promise.all([
    getCampaignAction(id),
    getCampaignStatsAction(id),
  ]);

  if (!campaignResult.success || !campaignResult.data) redirect("/marketing/campaigns");

  const canManage = userHasPermission(user, "marketing:manage");
  const canSend = userHasPermission(user, "marketing:send");

  return (
    <CampaignDetailContent
      campaign={campaignResult.data}
      stats={statsResult.data ?? { byStatus: {}, total: 0 }}
      canManage={canManage}
      canSend={canSend}
    />
  );
}
