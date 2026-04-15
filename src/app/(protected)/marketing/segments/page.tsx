import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { getDefaultFilter } from "@/lib/actions/saved-filters";
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

  let effective: Record<string, string | undefined> = params;
  if (Object.keys(params).length === 0) {
    const def = await getDefaultFilter("segments");
    if (def) effective = def.filters as Record<string, string>;
  }

  return <SegmentsListContent canManage={canManage} initialFilters={effective} />;
}
