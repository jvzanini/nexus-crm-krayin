import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { ProductsContent } from "./_components/products-content";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "products:view")) redirect("/dashboard");

  const canCreate = userHasPermission(user, "products:create");
  const canEdit = userHasPermission(user, "products:edit");
  const canDelete = userHasPermission(user, "products:delete");

  return (
    <ProductsContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
