import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { FlagsContent } from "./_components/flags-content";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "flags:manage")) redirect("/dashboard");

  return <FlagsContent />;
}
