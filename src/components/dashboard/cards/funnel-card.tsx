"use client";

import { Card } from "@nexusai360/design-system";
import type { FunnelStep } from "@/lib/actions/dashboard";

interface FunnelCardProps {
  data: FunnelStep[];
}

export function FunnelCard({ data }: FunnelCardProps) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <h3 className="text-base font-semibold mb-4">Funil de conversão</h3>
      {data.every((d) => d.count === 0) ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="space-y-3">
          {data.map((step) => {
            const widthPct = (step.count / max) * 100;
            return (
              <div key={step.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground">{step.label}</span>
                  <span className="font-semibold text-violet-500">{step.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 rounded-full transition-all"
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
