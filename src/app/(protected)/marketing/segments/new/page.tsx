import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { SegmentEditorContent } from "../_components/segment-editor-content";

export const dynamic = "force-dynamic";

export default async function SegmentNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "marketing:manage")) redirect("/marketing/segments");

  return <SegmentEditorContent mode="create" />;
}
