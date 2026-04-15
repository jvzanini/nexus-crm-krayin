import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { listDistinctCategories } from "@/lib/actions/products";
import { getDefaultFilter } from "@/lib/actions/saved-filters";
import { ProductsContent } from "./_components/products-content";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "products:view")) redirect("/dashboard");

  const canCreate = userHasPermission(user, "products:create");
  const canEdit = userHasPermission(user, "products:edit");
  const canDelete = userHasPermission(user, "products:delete");

  const categoriesResult = await listDistinctCategories();
  const categoryOptions = categoriesResult.success && categoriesResult.data
    ? categoriesResult.data
    : [];

  let effective: Record<string, string | undefined> = params;
  if (Object.keys(params).length === 0) {
    const def = await getDefaultFilter("products");
    if (def) effective = def.filters as Record<string, string>;
  }

  return (
    <ProductsContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      initialFilters={effective}
      categoryOptions={categoryOptions}
    />
  );
}
