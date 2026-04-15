import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import { getDefaultFilter } from "@/lib/actions/saved-filters";
import { LeadsContent } from "./_components/leads-content";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = userHasPermission(user, "leads:create");
  const canEdit = userHasPermission(user, "leads:edit");
  const canDelete = userHasPermission(user, "leads:delete");

  const companyId = await requireActiveCompanyId().catch(() => null);
  const customDefs = companyId
    ? await listCustomAttributes(companyId, "lead")
    : [];

  // Fase 33 — auto-apply do filtro padrão quando sem query params.
  let effective: Record<string, string | undefined> = params;
  if (Object.keys(params).length === 0) {
    const def = await getDefaultFilter("leads");
    if (def) effective = def.filters as Record<string, string>;
  }

  return (
    <LeadsContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      initialFilters={effective}
      customDefs={customDefs}
    />
  );
}
