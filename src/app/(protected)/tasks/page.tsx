import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { requireCompanyRole } from "@/lib/tenant";
import { getCompanyAssignees } from "@/lib/actions/leads";
import { getDefaultFilter } from "@/lib/actions/saved-filters";
import { TasksContent } from "./_components/tasks-content";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "activities:view")) redirect("/dashboard");

  const canCreate = userHasPermission(user, "activities:create");
  const canEdit = userHasPermission(user, "activities:edit");
  const canDelete = userHasPermission(user, "activities:delete");
  const canComplete = userHasPermission(user, "activities:complete");

  // Descobre se user é manager/admin no tenant ativo para gatear "Todas"
  let canViewAll = false;
  let assigneeOptions: { id: string; name: string }[] = [];
  const companyId = await requireActiveCompanyId().catch(() => null);
  if (companyId) {
    canViewAll = await requireCompanyRole(user.id, companyId, "manager");
    if (canViewAll) {
      const res = await getCompanyAssignees();
      if (res.success && res.data) {
        assigneeOptions = res.data.map((u) => ({ id: u.id, name: u.name }));
      }
    }
  }

  let effective: Record<string, string | undefined> = params;
  if (Object.keys(params).length === 0) {
    const def = await getDefaultFilter("tasks");
    if (def) effective = def.filters as Record<string, string>;
  }

  return (
    <TasksContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      canComplete={canComplete}
      initialFilters={effective}
      assigneeOptions={assigneeOptions}
      canViewAll={canViewAll}
    />
  );
}
