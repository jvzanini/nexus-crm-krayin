import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { getReportsData } from "@/lib/actions/reports";
import { ReportsContent } from "./_components/reports-content";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (
    !userHasPermission(
      { platformRole: user.platformRole, isSuperAdmin: user.isSuperAdmin },
      "audit:view",
    )
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const period = Number(params.period);
  const periodDays = [7, 30, 90, 180].includes(period) ? period : 30;

  const result = await getReportsData({ periodDays });
  const data = result.success ? result.data : null;

  return <ReportsContent initialData={data} initialPeriod={periodDays} />;
}
