import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OpportunitiesContent } from "./_components/opportunities-content";

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const opportunities = await prisma.opportunity.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { contact: true },
  });

  return <OpportunitiesContent opportunities={opportunities} />;
}
