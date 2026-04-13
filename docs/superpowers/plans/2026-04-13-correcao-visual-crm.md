# Correção Visual CRM — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever todas as telas do CRM para seguir 1:1 o padrão visual do Roteador Webhook, eliminando divergências visuais e funcionais.

**Architecture:** Copiar componentes e páginas do Roteador Webhook (`/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/`), adaptando apenas o domínio CRM (webhooks → leads/contatos/oportunidades). Manter estrutura server component (page.tsx) + client component (_components/content.tsx).

**Tech Stack:** Next.js 16, TypeScript, Prisma v7, Tailwind CSS 4, Framer Motion, Lucide React, Recharts, Sonner, shadcn/ui (base-ui)

---

### Task 1: Sidebar — Corrigir logo e user info

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Substituir logo gradient por imagem**

Substituir o bloco do logo (linhas 67-83) por:

```tsx
<div className="flex items-center gap-3 px-6 py-6">
  <Image src="/logo.png" alt="Nexus AI" width={40} height={40} className="rounded-[22%] shadow-[0_0_12px_rgba(124,58,237,0.3)]" />
  <div>
    <h1 className="text-base font-bold text-foreground tracking-tight">Nexus AI</h1>
    <p className="text-[11px] text-muted-foreground leading-none">CRM</p>
  </div>
</div>
```

Adicionar import no topo:
```tsx
import Image from "next/image";
```

Remover import `APP_CONFIG` e `PLATFORM_ROLE_STYLES` (não usados mais no sidebar logo).

- [ ] **Step 2: Alterar user info bottom — mostrar role em vez de email**

Substituir a linha 160 (`<p className="text-[11px]...`):

```tsx
<p className="text-[11px] text-muted-foreground truncate">{user.role}</p>
```

Em vez de `{user.email}`.

- [ ] **Step 3: Verificar que funciona**

Run: `cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && npx next build 2>&1 | tail -5`
Expected: Build sem erros

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "fix(sidebar): usar logo imagem e mostrar role no user info"
```

---

### Task 2: Dashboard — Rewrite completo com dados reais

**Files:**
- Modify: `src/lib/actions/dashboard.ts`
- Create: `src/components/dashboard/stats-cards.tsx`
- Create: `src/components/dashboard/dashboard-filters.tsx`
- Create: `src/components/dashboard/recent-activity.tsx`
- Modify: `src/components/dashboard/dashboard-content.tsx`
- Modify: `src/app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Reescrever server action getDashboardData**

Substituir todo o conteúdo de `src/lib/actions/dashboard.ts` por:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { subDays, startOfDay, startOfMonth, format } from "date-fns";

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

export interface DashboardData {
  stats: DashboardStats;
  chart: ChartDataPoint[];
  recentActivity: {
    items: RecentActivityItem[];
    currentPage: number;
    totalPages: number;
  };
}

function getPeriodDates(period: string) {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "30d":
    default:
      return { start: subDays(now, 30), end: now };
  }
}

function getPreviousPeriodDates(period: string) {
  const { start, end } = getPeriodDates(period);
  const diff = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - diff),
    end: new Date(end.getTime() - diff),
  };
}

function calcComparison(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardData(
  period = "today",
  page = 1
): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  const { start, end } = getPeriodDates(period);
  const prev = getPreviousPeriodDates(period);
  const pageSize = 10;

  const [
    currentLeads, prevLeads,
    currentContacts, prevContacts,
    currentOpenOpp, prevOpenOpp,
    totalLeads, wonOpp,
    prevTotalLeads, prevWonOpp,
    recentLeads, recentContacts, recentOpportunities,
    totalActivityCount,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.lead.count({ where: { createdAt: { gte: prev.start, lte: prev.end } } }),
    prisma.contact.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.contact.count({ where: { createdAt: { gte: prev.start, lte: prev.end } } }),
    prisma.opportunity.count({ where: { stage: { notIn: ["closed_won", "closed_lost"] }, createdAt: { gte: start, lte: end } } }),
    prisma.opportunity.count({ where: { stage: { notIn: ["closed_won", "closed_lost"] }, createdAt: { gte: prev.start, lte: prev.end } } }),
    prisma.lead.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.opportunity.count({ where: { stage: "closed_won", createdAt: { gte: start, lte: end } } }),
    prisma.lead.count({ where: { createdAt: { gte: prev.start, lte: prev.end } } }),
    prisma.opportunity.count({ where: { stage: "closed_won", createdAt: { gte: prev.start, lte: prev.end } } }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: { id: true, name: true, status: true, createdAt: true },
    }),
    prisma.contact.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, createdAt: true },
    }),
    prisma.opportunity.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, stage: true, createdAt: true },
    }),
    prisma.lead.count(),
  ]);

  const conversionRate = totalLeads > 0 ? (wonOpp / totalLeads) * 100 : null;
  const prevConversionRate = prevTotalLeads > 0 ? (prevWonOpp / prevTotalLeads) * 100 : null;

  // Build chart data — last 7 days or 30 days grouped
  const chartDays = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const chart: ChartDataPoint[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const [dayLeads, dayOpp] = await Promise.all([
      prisma.lead.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.opportunity.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
    ]);
    chart.push({
      label: format(day, "dd/MM"),
      leads: dayLeads,
      opportunities: dayOpp,
    });
  }

  // Recent activity: merge and sort
  const activities: RecentActivityItem[] = [
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
      action: "Contato adicionado",
      entityName: `${c.firstName} ${c.lastName}`,
      status: "active",
      createdAt: c.createdAt.toISOString(),
    })),
    ...recentOpportunities.map((o) => ({
      id: o.id,
      type: "opportunity" as const,
      action: "Oportunidade criada",
      entityName: o.title,
      status: o.stage,
      createdAt: o.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, pageSize);

  return {
    success: true,
    data: {
      stats: {
        totalLeads: currentLeads,
        totalContacts: currentContacts,
        openOpportunities: currentOpenOpp,
        conversionRate,
        comparison: {
          totalLeads: calcComparison(currentLeads, prevLeads),
          totalContacts: calcComparison(currentContacts, prevContacts),
          openOpportunities: calcComparison(currentOpenOpp, prevOpenOpp),
          conversionRate: conversionRate !== null && prevConversionRate !== null
            ? conversionRate - prevConversionRate
            : null,
        },
      },
      chart,
      recentActivity: {
        items: activities,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalActivityCount / pageSize)),
      },
    },
  };
}
```

- [ ] **Step 2: Criar StatsCards**

Criar `src/components/dashboard/stats-cards.tsx` — copiando padrão visual exato do Roteador, adaptando labels para CRM:

```tsx
"use client";

import { motion } from "framer-motion";
import { Target, Users, TrendingUp, ArrowUpRight, ArrowDownRight, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats } from "@/lib/actions/dashboard";

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Leads",
      value: stats.totalLeads.toLocaleString("pt-BR"),
      comparison: stats.comparison.totalLeads,
      icon: Target,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
      invertTrend: false,
    },
    {
      label: "Contatos",
      value: stats.totalContacts.toLocaleString("pt-BR"),
      comparison: stats.comparison.totalContacts,
      icon: Users,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      invertTrend: false,
    },
    {
      label: "Oportunidades Abertas",
      value: stats.openOpportunities.toLocaleString("pt-BR"),
      comparison: stats.comparison.openOpportunities,
      icon: TrendingUp,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      invertTrend: false,
    },
    {
      label: "Taxa de Conversão",
      value: stats.conversionRate !== null
        ? `${stats.conversionRate.toFixed(1)}%`
        : "\u2014",
      comparison: stats.comparison.conversionRate,
      icon: Percent,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
      invertTrend: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const isPositive = card.comparison !== null && card.comparison > 0;
        const isNegative = card.comparison !== null && card.comparison < 0;
        const trendIsGood = card.invertTrend ? isNegative : isPositive;
        const trendIsBad = card.invertTrend ? isPositive : isNegative;

        return (
          <motion.div key={card.label} variants={itemVariants}>
            <Card className="bg-card border border-border hover:border-muted-foreground/30 transition-all duration-200 rounded-xl cursor-default">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                    <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    {card.comparison === null ? (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                        Novo
                      </Badge>
                    ) : (
                      <span className={trendIsGood ? "text-emerald-400" : trendIsBad ? "text-red-400" : "text-muted-foreground"}>
                        <span className="inline-flex items-center gap-0.5">
                          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : isNegative ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                          {card.comparison > 0 ? "+" : ""}{card.comparison.toFixed(1)}%
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Criar DashboardFilters**

Criar `src/components/dashboard/dashboard-filters.tsx`:

```tsx
"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardFiltersProps {
  selectedPeriod: string;
  isLoading: boolean;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
}

const periods = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export function DashboardFilters({
  selectedPeriod,
  isLoading,
  onPeriodChange,
  onRefresh,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto sm:ml-auto">
        <div className="flex rounded-xl border border-border overflow-hidden bg-card/80">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                selectedPeriod === p.value
                  ? "bg-violet-600 text-white shadow-[0_0_8px_rgba(124,58,237,0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-9 w-9 rounded-lg border-border bg-card/80 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar RecentActivity**

Criar `src/components/dashboard/recent-activity.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChevronLeft, ChevronRight, Target, Users, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RecentActivityItem } from "@/lib/actions/dashboard";

interface RecentActivityProps {
  items: RecentActivityItem[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const typeIcons = {
  lead: Target,
  contact: Users,
  opportunity: TrendingUp,
};

const typeLabels = {
  lead: "Lead",
  contact: "Contato",
  opportunity: "Oportunidade",
};

export function RecentActivity({ items, currentPage, totalPages, onPageChange }: RecentActivityProps) {
  return (
    <Card className="bg-card border border-border rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          Atividades Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-b-xl overflow-x-auto">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Quando</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Tipo</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Ação</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Nome</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma atividade no período
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => {
                const TypeIcon = typeIcons[item.type];
                return (
                  <TableRow key={`${item.type}-${item.id}`} className="border-border/50 hover:bg-accent/30 transition-colors">
                    <TableCell className="text-xs text-muted-foreground py-2.5">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-xs border-border text-foreground/80 gap-1">
                        <TypeIcon className="h-3 w-3" />
                        {typeLabels[item.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-2.5">{item.action}</TableCell>
                    <TableCell className="text-sm text-foreground py-2.5 font-medium">{item.entityName}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="gap-1 border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="gap-1 border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Reescrever DashboardContent**

Substituir todo o conteúdo de `src/components/dashboard/dashboard-content.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { getDashboardData, type DashboardData } from "@/lib/actions/dashboard";
import { LayoutDashboard } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { DashboardFilters } from "./dashboard-filters";
import { StatsCards } from "./stats-cards";
import { RecentActivity } from "./recent-activity";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface DashboardContentProps {
  userName: string;
  isSuperAdmin?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const POLL_INTERVAL = 60_000;

export function DashboardContent({ userName }: DashboardContentProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [period, setPeriod] = useState("today");
  const [page, setPage] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const result = await getDashboardData(period, page);
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [period, page]);

  useEffect(() => {
    fetchData(isInitialLoad);
    timerRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData, isInitialLoad]);

  function handleRefresh() {
    if (timerRef.current) clearInterval(timerRef.current);
    fetchData(false);
    timerRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);
  }

  function handlePeriodChange(p: string) {
    setPeriod(p);
    setPage(1);
  }

  const now = new Date();
  const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const weekday = weekdays[now.getDay()];
  const day = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const today = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} de ${year}`;

  if (isInitialLoad && !data) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-card border border-border rounded-xl" />
          ))}
        </div>
        <div className="h-[350px] bg-card border border-border rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
          <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Sem dados para exibir</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Comece adicionando leads, contatos e oportunidades para visualizar o dashboard.
        </p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Greeting + Bell */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Olá, {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <NotificationBell />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <DashboardFilters
          selectedPeriod={period}
          isLoading={isLoading}
          onPeriodChange={handlePeriodChange}
          onRefresh={handleRefresh}
        />
      </motion.div>

      {/* Stats Cards */}
      <StatsCards stats={data.stats} />

      {/* Chart */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              Pipeline — Leads vs Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="leads" stroke="#7c3aed" strokeWidth={2} dot={false} name="Leads" />
                <Line type="monotone" dataKey="opportunities" stroke="#f59e0b" strokeWidth={2} dot={false} name="Oportunidades" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants}>
        <RecentActivity
          items={data.recentActivity.items}
          currentPage={data.recentActivity.currentPage}
          totalPages={data.recentActivity.totalPages}
          onPageChange={setPage}
        />
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 6: Atualizar page.tsx do dashboard**

Verificar que `src/app/(protected)/dashboard/page.tsx` passa userName corretamente (provavelmente já está ok, mas garantir que passa `userName.split(" ")[0]` para o primeiro nome).

- [ ] **Step 7: Build e commit**

Run: `cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && npx next build 2>&1 | tail -10`
Expected: Build sem erros

```bash
git add src/lib/actions/dashboard.ts src/components/dashboard/ src/app/(protected)/dashboard/
git commit -m "feat(dashboard): rewrite com dados reais, filtros, stats cards e atividades recentes"
```

---

### Task 3: Perfil — Refactor para server/client + copiar visual do Roteador

**Files:**
- Modify: `src/app/(protected)/profile/page.tsx`
- Create: `src/app/(protected)/profile/_components/profile-content.tsx`

- [ ] **Step 1: Criar profile-content.tsx copiando do Roteador**

Criar `src/app/(protected)/profile/_components/profile-content.tsx` — copiar **exatamente** o `ProfileContent` do Roteador (`/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/src/app/(protected)/profile/profile-content.tsx`), adaptando apenas os imports:
- `@/lib/actions/profile` → manter (mesmo path)
- Verificar se `updateProfile` aceita `(name, avatarUrl)` — se não, ajustar assinatura

Os 4 cards são:
1. Informações Pessoais (avatar upload + nome + membro desde)
2. E-mail (email atual disabled + novo email + senha confirmação + estado de sucesso)
3. Alterar Senha (eye/eyeOff toggle + validação inline)
4. Aparência (3 botões tema com description)

- [ ] **Step 2: Converter page.tsx para server component**

Substituir todo o conteúdo de `src/app/(protected)/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileContent } from "./_components/profile-content";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ProfileContent />;
}
```

- [ ] **Step 3: Verificar que profile actions suportam a interface**

Verificar em `src/lib/actions/profile.ts` que:
- `getProfile()` retorna `{ success, data: { name, email, avatarUrl, createdAt } }`
- `updateProfile(name, avatarUrl)` aceita 2 parâmetros
- `requestEmailChange(newEmail, password)` aceita 2 parâmetros
- `changePassword(currentPassword, newPassword)` aceita 2 parâmetros

Se alguma divergir, ajustar a action ou o component.

- [ ] **Step 4: Build e commit**

```bash
git add src/app/(protected)/profile/
git commit -m "refactor(perfil): separar server/client e copiar visual 1:1 do Roteador"
```

---

### Task 4: Empresas — Criar página CRUD do zero

**Files:**
- Create: `src/app/(protected)/companies/page.tsx`
- Create: `src/app/(protected)/companies/_components/companies-content.tsx`

- [ ] **Step 1: Criar page.tsx server component**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CompaniesContent } from "./_components/companies-content";

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CompaniesContent currentUser={user} />;
}
```

- [ ] **Step 2: Criar companies-content.tsx**

Seguir o padrão exato do Roteador users-content.tsx, adaptando para empresas:
- Header com Building2 icon + "Nova Empresa" button
- Table com colunas: Nome, Documento, Membros, Status, Criado em, Ações
- Create dialog: nome, documento (CNPJ/CPF), descrição
- Edit dialog: mesmos campos
- Delete dialog com AlertDialog
- Motion animations (containerVariants + itemVariants + row stagger)
- Skeleton loading
- Empty state

Usar server actions de `@/lib/actions/company.ts` (getCompanies, createCompany, updateCompany, deleteCompany).

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/companies/
git commit -m "feat(empresas): criar página CRUD com visual padrão Roteador"
```

---

### Task 5: Leads — Converter para tabela com CRUD

**Files:**
- Modify: `src/app/(protected)/leads/_components/leads-content.tsx`
- Modify: `src/app/(protected)/leads/page.tsx`

- [ ] **Step 1: Reescrever leads-content.tsx com tabela + CRUD**

Converter de lista simples para tabela completa seguindo padrão Roteador:
- Table com colunas: Nome, Email, Telefone, Status (BadgeSelect inline ou Badge), Empresa, Criado em, Ações
- Header com Target icon + "Novo Lead" button (bg-violet-600)
- Create dialog (nome, email, telefone, empresa, fonte)
- Edit dialog
- Delete AlertDialog
- Filtros de status (manter botões toggle existentes)
- Motion animations
- Skeleton loading

Usar/criar server actions em `src/lib/actions/leads.ts`: getLeads, createLead, updateLead, deleteLead.

- [ ] **Step 2: Atualizar page.tsx para carregar dados via action**

Se page.tsx está fazendo query Prisma direto, mover para server action.

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/leads/
git commit -m "feat(leads): converter para tabela CRUD com visual padrão Roteador"
```

---

### Task 6: Contatos — Converter para tabela com CRUD

**Files:**
- Modify: `src/app/(protected)/contacts/_components/contacts-content.tsx`
- Modify: `src/app/(protected)/contacts/page.tsx`

- [ ] **Step 1: Reescrever contacts-content.tsx com tabela + CRUD**

Mesmo padrão do Task 5, adaptando colunas:
- Table: Nome Completo, Email, Telefone, Empresa, Cargo, Criado em, Ações
- Header com Users icon (emerald) + "Novo Contato" button
- Create/Edit/Delete dialogs
- Motion animations + skeleton

Server actions: getContacts, createContact, updateContact, deleteContact.

- [ ] **Step 2: Build e commit**

```bash
git add src/app/(protected)/contacts/
git commit -m "feat(contatos): converter para tabela CRUD com visual padrão Roteador"
```

---

### Task 7: Oportunidades — Converter para tabela com CRUD

**Files:**
- Modify: `src/app/(protected)/opportunities/_components/opportunities-content.tsx`
- Modify: `src/app/(protected)/opportunities/page.tsx`

- [ ] **Step 1: Reescrever opportunities-content.tsx com tabela + CRUD**

Mesmo padrão:
- Table: Título, Contato, Valor (R$), Stage (BadgeSelect inline), Probabilidade, Criado em, Ações
- Header com TrendingUp icon + "Nova Oportunidade" button
- Create/Edit/Delete dialogs
- Stage badges coloridos
- Filtros de stage (manter toggle existente)
- Valor formatado com `toLocaleString("pt-BR")`

Server actions: getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity.

- [ ] **Step 2: Build e commit**

```bash
git add src/app/(protected)/opportunities/
git commit -m "feat(oportunidades): converter para tabela CRUD com visual padrão Roteador"
```

---

### Task 8: Usuários — Verificar e alinhar com Roteador

**Files:**
- Modify: `src/app/(protected)/users/_components/users-content.tsx`

- [ ] **Step 1: Comparar com Roteador users-content.tsx**

Verificar se o CRM tem TODAS as features do Roteador:
- BadgeSelect inline para role com ícones + descrições (Crown, ShieldCheck, Shield, Eye)
- BadgeSelect inline para status (Ativo/Inativo com UserCheck/UserX)
- Coluna Empresas (companiesCount)
- Coluna Criado em (format date-fns PT-BR)
- Create/Edit dialog com PasswordInput toggle
- Delete AlertDialog com AlertTriangle
- TableSkeleton
- Empty state
- Permissões (canEdit, canDelete, isOwnUser, isTargetSuperAdmin)
- motion.tr com row stagger

Se faltar algo, copiar 1:1 do Roteador.

- [ ] **Step 2: Garantir que server action getUsers() retorna UserItem com todos os campos**

Verificar que `getUsers()` retorna: id, name, email, platformRole, highestRole, isActive, companiesCount, createdAt, canEdit, canDelete, avatarUrl.

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/users/
git commit -m "fix(usuários): alinhar visual 1:1 com Roteador Webhook"
```

---

### Task 9: Configurações — Funcionalizar com server actions

**Files:**
- Modify: `src/app/(protected)/settings/_components/settings-content.tsx`

- [ ] **Step 1: Reescrever com dados reais**

Copiar padrão do Roteador settings-content.tsx, adaptando seções para domínio CRM:
- Seção Geral: Nome plataforma, email suporte (saves reais via `updateSettings()`)
- Seção Notificações: Toggle email, toggle plataforma (saves reais)
- Seção Sistema: Toggle modo manutenção (save real)
- Carregar valores atuais via `getAllSettings()` no mount
- FieldLabel/FieldHint components
- containerVariants/itemVariants com stagger

- [ ] **Step 2: Build e commit**

```bash
git add src/app/(protected)/settings/
git commit -m "fix(configurações): funcionalizar saves com server actions"
```

---

### Task 10: Verificação final

- [ ] **Step 1: Full build**

Run: `cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && npx next build`
Expected: Build completo sem erros

- [ ] **Step 2: Verificar todas as rotas**

Subir dev server e verificar manualmente:
- `/dashboard` — greeting sem emoji, NotificationBell, filtros, stats cards, gráfico, atividades recentes
- `/profile` — 4 cards (info pessoais com avatar, email, senha, aparência)
- `/companies` — CRUD funcional com tabela
- `/leads` — tabela com CRUD
- `/contacts` — tabela com CRUD
- `/opportunities` — tabela com CRUD
- `/users` — BadgeSelect inline, todas as colunas
- `/settings` — saves funcionais
- Sidebar — logo imagem, role no user info

- [ ] **Step 3: Commit final se houver ajustes**

```bash
git add -A
git commit -m "fix: ajustes finais de verificação visual"
```
