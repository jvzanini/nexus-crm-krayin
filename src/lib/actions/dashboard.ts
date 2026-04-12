"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function getDashboardMetrics() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  const [
    totalLeads,
    newLeadsThisMonth,
    totalContacts,
    totalOpportunities,
    wonOpportunities,
    totalUsers,
    recentLeads,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({
      where: {
        createdAt: { gte: new Date(new Date().setDate(1)) },
      },
    }),
    prisma.contact.count(),
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { stage: "closed_won" } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    }),
  ]);

  return {
    success: true,
    metrics: {
      totalLeads,
      newLeadsThisMonth,
      totalContacts,
      totalOpportunities,
      wonOpportunities,
      totalUsers,
      conversionRate:
        totalLeads > 0 ? Math.round((wonOpportunities / totalLeads) * 100) : 0,
    },
    recentLeads,
  };
}
