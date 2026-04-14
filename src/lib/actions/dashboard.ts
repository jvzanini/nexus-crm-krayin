"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { subDays, startOfDay, format } from "date-fns";

// --- Types ---

export interface DashboardStats {
  totalLeads: number;
  totalContacts: number;
  openOpportunities: number;
  conversionRate: number | null;
  comparison: {
    totalLeads: number | null;
    totalContacts: number | null;
    openOpportunities: number | null;
    conversionRate: number | null;
  };
}

export interface ChartDataPoint {
  label: string;
  leads: number;
  opportunities: number;
}

export interface RecentActivityItem {
  id: string;
  type: "lead" | "contact" | "opportunity";
  action: string;
  entityName: string;
  status: string;
  createdAt: string;
}

export interface FunnelStep {
  stage: "leads" | "contacts" | "opportunities" | "won";
  label: string;
  count: number;
}

export interface PipelineStageValue {
  stage: string; // OpportunityStage
  count: number;
  valueCents: number;
}

export interface TopOpportunity {
  id: string;
  title: string;
  value: number | null;
  probability: number | null;
  stage: string;
  contactName: string | null;
}

export interface DashboardData {
  stats: DashboardStats;
  chart: ChartDataPoint[];
  recentActivity: {
    items: RecentActivityItem[];
    currentPage: number;
    totalPages: number;
  };
  funnel: FunnelStep[];
  pipelineByStage: PipelineStageValue[];
  topOpportunities: TopOpportunity[];
}

// --- Helpers ---

const PAGE_SIZE = 10;

function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (period) {
    case "7d":
      start = subDays(startOfDay(now), 7);
      break;
    case "30d":
      start = subDays(startOfDay(now), 30);
      break;
    default: // "today"
      start = startOfDay(now);
      break;
  }

  return { start, end };
}

function getComparisonRange(period: string): { start: Date; end: Date } {
  const { start, end } = getPeriodRange(period);
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: start,
  };
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

// --- Main ---

export async function getDashboardData(
  period = "today",
  page = 1
): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  const { start, end } = getPeriodRange(period);
  const comp = getComparisonRange(period);

  // Current period counts
  const [
    totalLeads,
    totalContacts,
    openOpportunities,
    totalOppsCurrent,
    wonOppsCurrent,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),
    prisma.contact.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),
    prisma.opportunity.count({
      where: {
        companyId,
        createdAt: { gte: start, lte: end },
        stage: { notIn: ["closed_won", "closed_lost"] },
      },
    }),
    prisma.opportunity.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),
    prisma.opportunity.count({
      where: { companyId, createdAt: { gte: start, lte: end }, stage: "closed_won" },
    }),
  ]);

  // Comparison period counts
  const [
    prevLeads,
    prevContacts,
    prevOpenOpps,
    prevTotalOpps,
    prevWonOpps,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId, createdAt: { gte: comp.start, lt: comp.end } } }),
    prisma.contact.count({ where: { companyId, createdAt: { gte: comp.start, lt: comp.end } } }),
    prisma.opportunity.count({
      where: {
        companyId,
        createdAt: { gte: comp.start, lt: comp.end },
        stage: { notIn: ["closed_won", "closed_lost"] },
      },
    }),
    prisma.opportunity.count({ where: { companyId, createdAt: { gte: comp.start, lt: comp.end } } }),
    prisma.opportunity.count({
      where: { companyId, createdAt: { gte: comp.start, lt: comp.end }, stage: "closed_won" },
    }),
  ]);

  const conversionRate =
    totalOppsCurrent > 0 ? (wonOppsCurrent / totalOppsCurrent) * 100 : null;
  const prevConversionRate =
    prevTotalOpps > 0 ? (prevWonOpps / prevTotalOpps) * 100 : null;

  const stats: DashboardStats = {
    totalLeads,
    totalContacts,
    openOpportunities,
    conversionRate,
    comparison: {
      totalLeads: percentDelta(totalLeads, prevLeads),
      totalContacts: percentDelta(totalContacts, prevContacts),
      openOpportunities: percentDelta(openOpportunities, prevOpenOpps),
      conversionRate:
        conversionRate !== null && prevConversionRate !== null
          ? conversionRate - prevConversionRate
          : null,
    },
  };

  // --- Chart: aggregate by day ---
  const dayCount = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const chartDays: Date[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    chartDays.push(startOfDay(subDays(new Date(), i)));
  }

  // Batch: get all leads and opportunities in range, group in JS
  const [leadsInRange, oppsInRange] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
  ]);

  const leadsByDay = new Map<string, number>();
  const oppsByDay = new Map<string, number>();

  for (const l of leadsInRange) {
    const key = format(l.createdAt, "yyyy-MM-dd");
    leadsByDay.set(key, (leadsByDay.get(key) ?? 0) + 1);
  }
  for (const o of oppsInRange) {
    const key = format(o.createdAt, "yyyy-MM-dd");
    oppsByDay.set(key, (oppsByDay.get(key) ?? 0) + 1);
  }

  const chart: ChartDataPoint[] = chartDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      label: format(d, "dd/MM"),
      leads: leadsByDay.get(key) ?? 0,
      opportunities: oppsByDay.get(key) ?? 0,
    };
  });

  // --- Recent activity (merge + paginate) ---
  const [recentLeads, recentContacts, recentOpps] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, createdAt: true },
    }),
    prisma.contact.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, stage: true, createdAt: true },
    }),
  ]);

  const allActivity: RecentActivityItem[] = [
    ...recentLeads.map((l) => ({
      id: l.id,
      type: "lead" as const,
      action: "Lead criado",
      entityName: l.name,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    })),
    ...recentContacts.map((c) => ({
      id: c.id,
      type: "contact" as const,
      action: "Contato criado",
      entityName: `${c.firstName} ${c.lastName}`,
      status: "ativo",
      createdAt: c.createdAt.toISOString(),
    })),
    ...recentOpps.map((o) => ({
      id: o.id,
      type: "opportunity" as const,
      action: "Oportunidade criada",
      entityName: o.title,
      status: o.stage,
      createdAt: o.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalActivityCount = allActivity.length;
  const totalPages = Math.max(1, Math.ceil(totalActivityCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedItems = allActivity.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // --- Funnel (4 etapas) ---
  const [leadsCount, contactsCount, oppsCount, wonCount] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.contact.count({ where: { companyId } }),
    prisma.opportunity.count({ where: { companyId } }),
    prisma.opportunity.count({ where: { companyId, stage: "closed_won" } }),
  ]);

  const funnel: FunnelStep[] = [
    { stage: "leads", label: "Leads", count: leadsCount },
    { stage: "contacts", label: "Contatos", count: contactsCount },
    { stage: "opportunities", label: "Oportunidades", count: oppsCount },
    { stage: "won", label: "Ganhos", count: wonCount },
  ];

  // --- Pipeline by stage ---
  const pipelineRaw = await prisma.opportunity.groupBy({
    by: ["stage"],
    where: { companyId },
    _count: { _all: true },
    _sum: { value: true },
  });

  const pipelineByStage: PipelineStageValue[] = pipelineRaw.map((p) => ({
    stage: p.stage,
    count: p._count._all,
    valueCents: p._sum.value ? Number(p._sum.value) * 100 : 0,
  }));

  // --- Top 5 opportunities (exclui closed_won/closed_lost) ---
  const topOppsRaw = await prisma.opportunity.findMany({
    where: {
      companyId,
      stage: { notIn: ["closed_won", "closed_lost"] },
    },
    orderBy: { value: "desc" },
    take: 5,
    include: { contact: { select: { firstName: true, lastName: true } } },
  });

  const topOpportunities: TopOpportunity[] = topOppsRaw.map((o) => ({
    id: o.id,
    title: o.title,
    value: o.value ? Number(o.value) : null,
    probability: o.probability,
    stage: o.stage,
    contactName: o.contact
      ? `${o.contact.firstName ?? ""} ${o.contact.lastName ?? ""}`.trim() || null
      : null,
  }));

  return {
    success: true,
    data: {
      stats,
      chart,
      recentActivity: {
        items: paginatedItems,
        currentPage: safePage,
        totalPages,
      },
      funnel,
      pipelineByStage,
      topOpportunities,
    },
  };
}
