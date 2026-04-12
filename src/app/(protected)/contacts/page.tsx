import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ContactsContent } from "./_components/contacts-content";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <ContactsContent contacts={contacts} />;
}
