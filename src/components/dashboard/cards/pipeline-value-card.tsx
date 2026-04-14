"use client";

import { Card } from "@nexusai360/design-system";
import type { PipelineStageValue } from "@/lib/actions/dashboard";
import { STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from "@/lib/opportunities/stage-config";
import type { OpportunityStage } from "@/generated/prisma/client";

interface PipelineValueCardProps {
  data: PipelineStageValue[];
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const COLOR_CLASS: Record<string, string> = {
  zinc: "bg-zinc-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
};

export function PipelineValueCard({ data }: PipelineValueCardProps) {
  const byStage = new Map(data.map((d) => [d.stage, d]));
  const ordered = STAGE_ORDER.map(
    (s) => byStage.get(s as string) ?? { stage: s as string, count: 0, valueCents: 0 }
  );
  const max = Math.max(...ordered.map((d) => d.valueCents), 1);
  const totalValue = ordered.reduce((a, b) => a + b.valueCents, 0);

  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-base font-semibold">Pipeline por stage</h3>
        <span className="text-xs text-muted-foreground">{formatBRL(totalValue)}</span>
      </div>
      {totalValue === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="space-y-2">
          {ordered.map((s) => {
            const widthPct = (s.valueCents / max) * 100;
            const color = STAGE_COLORS[s.stage as OpportunityStage];
            return (
              <div key={s.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground">
                    {STAGE_LABELS[s.stage as OpportunityStage]}
                  </span>
                  <span className="text-muted-foreground">
                    {s.count} • {formatBRL(s.valueCents)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${COLOR_CLASS[color] ?? "bg-violet-600"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
