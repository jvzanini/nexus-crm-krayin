"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { getDashboardData, type DashboardData } from "@/lib/actions/dashboard";
import { LayoutDashboard, TrendingUp } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { DashboardFilters } from "./dashboard-filters";
import { StatsCards } from "./stats-cards";
import { RecentActivity } from "./recent-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@nexusai360/design-system";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardContentProps {
  userName: string;
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
      // silencioso
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [period, page]);

  // Polling
  useEffect(() => {
    fetchData(!data);

    timerRef.current = setInterval(() => {
      fetchData(false);
    }, POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  function handleRefresh() {
    if (timerRef.current) clearInterval(timerRef.current);
    fetchData(false);
    timerRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);
  }

  function handlePeriodChange(p: string) {
    setPeriod(p);
    setPage(1);
  }

  function handlePageChange(p: number) {
    setPage(p);
  }

  const now = new Date();
  const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const weekday = weekdays[now.getDay()];
  const day = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const today = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} de ${year}`;

  // Skeleton loading no primeiro carregamento
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
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Sem dados para exibir
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Nenhum dado encontrado para o período selecionado.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
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
              Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                  name="Leads"
                />
                <Line
                  type="monotone"
                  dataKey="opportunities"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Oportunidades"
                />
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
          onPageChange={handlePageChange}
        />
      </motion.div>
    </motion.div>
  );
}
