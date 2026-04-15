import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { SegmentsListContent } from "./_components/segments-list-content";

export const dynamic = "force-dynamic";

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "marketing:view")) redirect("/dashboard");

  const canManage = userHasPermission(user, "marketing:manage");

  return <SegmentsListContent canManage={canManage} initialFilters={params} />;
}
