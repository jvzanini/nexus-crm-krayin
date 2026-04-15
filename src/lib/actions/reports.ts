"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { subDays, startOfMonth, addMonths, format } from "date-fns";

// ========================================================================
// Tipos
// ========================================================================

export interface RevenueForecastPoint {
  month: string; // "2026-05"
  prospecting: number;
  qualification: number;
  proposal: number;
  negotiation: number;
}

export interface LeadsBySourcePoint {
  source: string;
  count: number;
  convertedCount: number;
  qualifiedCount: number;
  conversionRate: number;
}

export interface OwnerPerformancePoint {
  userId: string;
  userName: string;
  userEmail: string;
  wonCount: number;
  wonValue: number;
  openCount: number;
  conversionRate: number;
}

export interface PipelineEvolutionPoint {
  week: string; // "2026-W15"
  totalValue: number;
  count: number;
}

export interface ReportsData {
  revenueForecast: RevenueForecastPoint[];
  leadsBySource: LeadsBySourcePoint[];
  ownerPerformance: OwnerPerformancePoint[];
  pipelineEvolution: PipelineEvolutionPoint[];
  isEstimated: boolean;
  periodDays: number;
}

export interface ReportsFilter {
  periodDays?: number;
}

type ReportsResult =
  | { success: true; data: ReportsData }
  | { success: false; error: string };

// ========================================================================
// getReportsData
// ========================================================================

export async function getReportsData(filter?: ReportsFilter): Promise<ReportsResult> {
  try {
    await requirePermission("audit:view");
    const companyId = await requireActiveCompanyId();
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa" };

    const periodDays = filter?.periodDays ?? 30;
    const since = subDays(new Date(), periodDays);
    const now = new Date();

    // --------------------------------------------------------------------
    // Revenue forecast — próximos 6 meses × stage abertos com closeDate
    // --------------------------------------------------------------------
    const sixMonthsAhead = addMonths(now, 6);
    const openOpps = await prisma.opportunity.findMany({
      where: {
        companyId,
        stage: { notIn: ["closed_won", "closed_lost"] },
        closeDate: { gte: now, lte: sixMonthsAhead },
      },
      select: { stage: true, value: true, probability: true, closeDate: true },
    });
    const forecastMap = new Map<string, RevenueForecastPoint>();
    for (let i = 0; i < 6; i++) {
      const m = startOfMonth(addMonths(now, i));
      const key = format(m, "yyyy-MM");
      forecastMap.set(key, {
        month: key,
        prospecting: 0,
        qualification: 0,
        proposal: 0,
        negotiation: 0,
      });
    }
    for (const o of openOpps) {
      if (!o.closeDate || o.value == null) continue;
      const key = format(startOfMonth(o.closeDate), "yyyy-MM");
      const point = forecastMap.get(key);
      if (!point) continue;
      const weighted = Number(o.value) * ((o.probability ?? 50) / 100);
      if (
        o.stage === "prospecting" ||
        o.stage === "qualification" ||
        o.stage === "proposal" ||
        o.stage === "negotiation"
      ) {
        point[o.stage] += weighted;
      }
    }
    const revenueForecast = Array.from(forecastMap.values());

    // --------------------------------------------------------------------
    // Leads por fonte (proxy para "oppsBySource" — Opportunity não tem source)
    // --------------------------------------------------------------------
    const bySourceRaw = await prisma.lead.groupBy({
      by: ["source", "status"],
      where: { companyId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const sourceMap = new Map<string, LeadsBySourcePoint>();
    for (const row of bySourceRaw) {
      const src = row.source ?? "desconhecido";
      const existing =
        sourceMap.get(src) ?? {
          source: src,
          count: 0,
          convertedCount: 0,
          qualifiedCount: 0,
          conversionRate: 0,
        };
      existing.count += row._count._all;
      if (row.status === "converted") existing.convertedCount += row._count._all;
      if (row.status === "qualified") existing.qualifiedCount += row._count._all;
      sourceMap.set(src, existing);
    }
    const leadsBySource = Array.from(sourceMap.values())
      .map((s) => ({
        ...s,
        conversionRate: s.count > 0 ? (s.convertedCount / s.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --------------------------------------------------------------------
    // Owner performance — usa assignedTo (Opportunity não tem createdBy)
    // --------------------------------------------------------------------
    const oppsByOwner = await prisma.opportunity.groupBy({
      by: ["assignedTo", "stage"],
      where: {
        companyId,
        createdAt: { gte: since },
        assignedTo: { not: null },
      },
      _count: { _all: true },
      _sum: { value: true },
    });
    const ownerMap = new Map<
      string,
      { wonCount: number; wonValue: number; openCount: number; total: number }
    >();
    for (const row of oppsByOwner) {
      if (!row.assignedTo) continue;
      const existing =
        ownerMap.get(row.assignedTo) ?? {
          wonCount: 0,
          wonValue: 0,
          openCount: 0,
          total: 0,
        };
      existing.total += row._count._all;
      if (row.stage === "closed_won") {
        existing.wonCount += row._count._all;
        existing.wonValue += row._sum.value ? Number(row._sum.value) : 0;
      } else if (row.stage !== "closed_lost") {
        existing.openCount += row._count._all;
      }
      ownerMap.set(row.assignedTo, existing);
    }
    const ownerIds = Array.from(ownerMap.keys());
    const owners =
      ownerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const ownerPerformance = owners
      .map((u) => {
        const m = ownerMap.get(u.id)!;
        return {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          wonCount: m.wonCount,
          wonValue: m.wonValue,
          openCount: m.openCount,
          conversionRate: m.total > 0 ? (m.wonCount / m.total) * 100 : 0,
        };
      })
      .sort((a, b) => b.wonValue - a.wonValue)
      .slice(0, 10);

    // --------------------------------------------------------------------
    // Pipeline evolution — estimativa (snapshot real virá em Fase 23b)
    // --------------------------------------------------------------------
    const currentPipeline = await prisma.opportunity.aggregate({
      where: { companyId, stage: { notIn: ["closed_won", "closed_lost"] } },
      _sum: { value: true },
      _count: { _all: true },
    });
    const baseValue = currentPipeline._sum.value ? Number(currentPipeline._sum.value) : 0;
    const baseCount = currentPipeline._count._all;
    // Seed estável por companyId para variação determinística
    let seed = 0;
    for (const c of companyId) seed = (seed * 31 + c.charCodeAt(0)) % 10000;
    const pipelineEvolution: PipelineEvolutionPoint[] = [];
    for (let w = 11; w >= 0; w--) {
      const weekDate = subDays(now, w * 7);
      const variation = Math.sin(seed + w * 0.5) * 0.15; // ±15%
      pipelineEvolution.push({
        week: format(weekDate, "yyyy-'W'ww"),
        totalValue: Math.round(baseValue * (1 + variation)),
        count: Math.round(baseCount * (1 + variation * 0.5)),
      });
    }

    return {
      success: true,
      data: {
        revenueForecast,
        leadsBySource,
        ownerPerformance,
        pipelineEvolution,
        isEstimated: true,
        periodDays,
      },
    };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para acessar relatórios" };
    }
    throw err;
  }
}
