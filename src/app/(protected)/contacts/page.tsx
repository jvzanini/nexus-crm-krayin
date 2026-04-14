import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { ContactsContent } from "./_components/contacts-content";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = userHasPermission(user, "contacts:create");
  const canEdit = userHasPermission(user, "contacts:edit");
  const canDelete = userHasPermission(user, "contacts:delete");

  return <ContactsContent canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />;
}
