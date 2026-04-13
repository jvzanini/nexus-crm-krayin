import { auth } from "@/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const fullName = session.user.name || session.user.email || "Usuário";
  const userName = fullName.split(" ")[0];
  const isSuperAdmin = (session.user as any)?.isSuperAdmin ?? false;

  return <DashboardContent userName={userName} isSuperAdmin={isSuperAdmin} />;
}
