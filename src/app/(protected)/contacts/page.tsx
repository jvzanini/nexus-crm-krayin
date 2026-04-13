import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ContactsContent } from "./_components/contacts-content";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ContactsContent />;
}
