import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { TasksContent } from "./_components/tasks-content";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "activities:view")) redirect("/dashboard");

  const canCreate = userHasPermission(user, "activities:create");
  const canEdit = userHasPermission(user, "activities:edit");
  const canDelete = userHasPermission(user, "activities:delete");
  const canComplete = userHasPermission(user, "activities:complete");

  return (
    <TasksContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      canComplete={canComplete}
    />
  );
}
