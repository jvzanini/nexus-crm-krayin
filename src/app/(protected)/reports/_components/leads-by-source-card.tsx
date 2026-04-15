"use client";

import { Card, Button } from "@nexusai360/design-system";
import { Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LeadsBySourcePoint } from "@/lib/actions/reports";
import { downloadCSV } from "@/lib/reports/csv-export";

interface Props {
  data: LeadsBySourcePoint[];
}

export function LeadsBySourceCard({ data }: Props) {
  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Leads por fonte</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top 10 fontes no período · com taxa de conversão
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCSV("leads-by-source.csv", data)}
          className="h-8 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Sem leads no período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="source"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={
                ((v: number, _name: string, item: { payload?: LeadsBySourcePoint }) => {
                  const p = item.payload;
                  return [
                    `${v} leads · conv ${p?.conversionRate.toFixed(1) ?? "0"}%`,
                    "Total",
                  ];
                }) as never
              }
            />
            <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
