import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { LeadsContent } from "./_components/leads-content";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = userHasPermission(user, "leads:create");
  const canEdit = userHasPermission(user, "leads:edit");
  const canDelete = userHasPermission(user, "leads:delete");

  return <LeadsContent canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />;
}
