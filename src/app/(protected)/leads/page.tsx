import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LeadsContent } from "./_components/leads-content";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <LeadsContent />;
}
