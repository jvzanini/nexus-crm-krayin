import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { getWorkflowAction } from "@/lib/actions/workflows";
import { WorkflowEditorContent } from "../_components/workflow-editor-content";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkflowEditPage({ params }: Props) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "workflows:view")) redirect("/dashboard");

  const canManage = userHasPermission(user, "workflows:manage");

  const result = await getWorkflowAction(id);
  if (!result.success || !result.data) {
    redirect("/automation/workflows");
  }

  return (
    <WorkflowEditorContent
      workflow={result.data}
      canManage={canManage}
      mode="edit"
    />
  );
}
