import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { WorkflowEditorContent } from "../_components/workflow-editor-content";

export const dynamic = "force-dynamic";

export default async function WorkflowNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "workflows:manage")) redirect("/automation/workflows");

  return <WorkflowEditorContent canManage={true} mode="create" />;
}
