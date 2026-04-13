import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OpportunitiesContent } from "./_components/opportunities-content";

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <OpportunitiesContent />;
}
