import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { CampaignEditorContent } from "../_components/campaign-editor-content";

export const dynamic = "force-dynamic";

export default async function CampaignNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "marketing:manage")) redirect("/marketing/campaigns");

  return <CampaignEditorContent mode="create" />;
}
