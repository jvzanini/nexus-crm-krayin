"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Card, Button } from "@nexusai360/design-system";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PipelineEvolutionPoint } from "@/lib/actions/reports";
import { downloadCSV } from "@/lib/reports/csv-export";

interface Props {
  data: PipelineEvolutionPoint[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function PipelineEvolutionCard({ data }: Props) {
  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Evolução do pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Últimas 12 semanas · valor total aberto
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCSV("pipeline-evolution.csv", data)}
          className="h-8 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      <div className="mb-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-500">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Dados estimados — snapshot semanal real será implementado em Fase 23b.
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="week"
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
            formatter={
              ((v: number, name: string) =>
                name === "totalValue"
                  ? [formatBRL(v), "Valor total"]
                  : [v, name]) as never
            }
          />
          <Line
            type="monotone"
            dataKey="totalValue"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={{ fill: "#7c3aed", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
