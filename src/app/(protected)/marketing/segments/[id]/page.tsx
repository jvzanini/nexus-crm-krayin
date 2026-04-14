import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { getSegmentAction } from "@/lib/actions/marketing-segments";
import { SegmentEditorContent } from "../_components/segment-editor-content";

export const dynamic = "force-dynamic";

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "marketing:view")) redirect("/dashboard");

  const { id } = await params;
  const result = await getSegmentAction(id);
  if (!result.success || !result.data) redirect("/marketing/segments");

  const canManage = userHasPermission(user, "marketing:manage");

  return (
    <SegmentEditorContent mode="edit" segment={result.data} canManage={canManage} />
  );
}
