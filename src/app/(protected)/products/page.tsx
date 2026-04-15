import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { listDistinctCategories } from "@/lib/actions/products";
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

  return (
    <ProductsContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      initialFilters={params}
      categoryOptions={categoryOptions}
    />
  );
}
