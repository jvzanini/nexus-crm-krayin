import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { WorkflowsListContent } from "./_components/workflows-list-content";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "workflows:view")) redirect("/dashboard");

  const canManage = userHasPermission(user, "workflows:manage");

  return <WorkflowsListContent canManage={canManage} initialFilters={params} />;
}
