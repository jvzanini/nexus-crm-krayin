import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CompaniesContent } from "./_components/companies-content";

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CompaniesContent currentUser={user} />;
}
