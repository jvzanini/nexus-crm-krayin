import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import { ContactsContent } from "./_components/contacts-content";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = userHasPermission(user, "contacts:create");
  const canEdit = userHasPermission(user, "contacts:edit");
  const canDelete = userHasPermission(user, "contacts:delete");

  let customDefs: Awaited<ReturnType<typeof listCustomAttributes>> = [];
  try {
    const companyId = await requireActiveCompanyId();
    customDefs = await listCustomAttributes(companyId, "contact");
  } catch {
    customDefs = [];
  }

  return (
    <ContactsContent
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      initialFilters={params}
      customDefs={customDefs}
    />
  );
}
