"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Target, Contact, TrendingUp, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  isSuperAdmin: boolean;
}

const MOCK_CHART = [
  { label: "Jan", leads: 12, oportunidades: 5 },
  { label: "Fev", leads: 18, oportunidades: 8 },
  { label: "Mar", leads: 24, oportunidades: 11 },
  { label: "Abr", leads: 20, oportunidades: 9 },
  { label: "Mai", leads: 30, oportunidades: 15 },
  { label: "Jun", leads: 28, oportunidades: 13 },
];

const STATS = [
  { label: "Leads", value: "42", icon: Target, color: "text-violet-400", bg: "bg-violet-500/10", delta: "+12%" },
  { label: "Contatos", value: "128", icon: Contact, color: "text-emerald-400", bg: "bg-emerald-500/10", delta: "+5%" },
  { label: "Oportunidades", value: "23", icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10", delta: "+8%" },
  { label: "Usuários", value: "7", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10", delta: "" },
];

export function DashboardContent({ userName }: DashboardContentProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const dateLabel = now
    ? format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {userName.split(" ")[0]} 👋
        </h1>
        {dateLabel && (
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" as const }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  {stat.delta && (
                    <span className="text-xs text-emerald-400 font-medium">
                      {stat.delta}
                    </span>
                  )}
                </div>
                <CardTitle className="text-2xl font-bold text-foreground mt-2">
                  {stat.value}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Pipeline — Últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={MOCK_CHART}>
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
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                name="Leads"
              />
              <Line
                type="monotone"
                dataKey="oportunidades"
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={false}
                name="Oportunidades"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
