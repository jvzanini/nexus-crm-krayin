import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import type { CustomAttribute } from "@/lib/custom-attributes/types";
import { getDefaultFilter } from "@/lib/actions/saved-filters";
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

  // T17 — fetch custom attribute definitions ativas p/ opportunity.
  let customDefs: CustomAttribute[] = [];
  try {
    const companyId = await requireActiveCompanyId();
    customDefs = await listCustomAttributes(companyId, "opportunity");
  } catch {
    // sem tenant ativo: renderiza sem customs (conteúdo trata erro).
  }

  let effective: Record<string, string | undefined> = params;
  if (Object.keys(params).length === 0) {
    const def = await getDefaultFilter("opportunities");
    if (def) effective = def.filters as Record<string, string>;
  }

  return (
    <OpportunitiesContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      initialFilters={effective}
      customDefs={customDefs}
    />
  );
}
