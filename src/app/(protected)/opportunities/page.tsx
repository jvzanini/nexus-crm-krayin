import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { OpportunitiesContent } from "./_components/opportunities-content";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = userHasPermission(user, "opportunities:create");
  const canEdit = userHasPermission(user, "opportunities:edit");
  const canDelete = userHasPermission(user, "opportunities:delete");

  return (
    <OpportunitiesContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      initialFilters={params}
    />
  );
}
