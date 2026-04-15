"use client";

import { Card, Button } from "@nexusai360/design-system";
import { Download } from "lucide-react";
import type { OwnerPerformancePoint } from "@/lib/actions/reports";
import { downloadCSV } from "@/lib/reports/csv-export";

interface Props {
  data: OwnerPerformancePoint[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function OwnerPerformanceCard({ data }: Props) {
  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Performance por responsável
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top 10 · oportunidades com assignedTo no período
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCSV("owner-performance.csv", data)}
          className="h-8 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Sem oportunidades com responsável no período.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2">Responsável</th>
                <th className="text-right font-medium py-2">Ganhos</th>
                <th className="text-right font-medium py-2">Valor</th>
                <th className="text-right font-medium py-2">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr
                  key={o.userId}
                  className="border-b border-border/60 hover:bg-accent/30 transition-colors"
                >
                  <td className="py-2.5">
                    <div className="font-medium text-foreground">{o.userName}</div>
                    <div className="text-xs text-muted-foreground">{o.userEmail}</div>
                  </td>
                  <td className="text-right py-2.5 text-foreground">{o.wonCount}</td>
                  <td className="text-right py-2.5 text-foreground font-medium">
                    {formatBRL(o.wonValue)}
                  </td>
                  <td className="text-right py-2.5 text-emerald-500">
                    {o.conversionRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
