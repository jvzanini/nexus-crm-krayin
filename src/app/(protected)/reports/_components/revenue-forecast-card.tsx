"use client";

import { Card, Button } from "@nexusai360/design-system";
import { Download } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { RevenueForecastPoint } from "@/lib/actions/reports";
import { downloadCSV } from "@/lib/reports/csv-export";

interface Props {
  data: RevenueForecastPoint[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function RevenueForecastCard({ data }: Props) {
  const total = data.reduce(
    (a, d) => a + d.prospecting + d.qualification + d.proposal + d.negotiation,
    0,
  );

  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Projeção de receita
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Próximos 6 meses × ponderada por probabilidade
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCSV("revenue-forecast.csv", data)}
          className="h-8 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {total === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Sem oportunidades abertas com data de fechamento nos próximos 6 meses.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={((v: number) => formatBRL(v)) as never}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="prospecting"
              name="Prospecção"
              stackId="1"
              stroke="#71717a"
              fill="#71717a"
              fillOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="qualification"
              name="Qualificação"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="proposal"
              name="Proposta"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="negotiation"
              name="Negociação"
              stackId="1"
              stroke="#7c3aed"
              fill="#7c3aed"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
