import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadsContent } from "./_components/leads-content";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <LeadsContent leads={leads} />;
}
