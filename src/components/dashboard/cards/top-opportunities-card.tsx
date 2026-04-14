"use client";

import Link from "next/link";
import { Card } from "@nexusai360/design-system";
import type { TopOpportunity } from "@/lib/actions/dashboard";
import { STAGE_LABELS } from "@/lib/opportunities/stage-config";
import type { OpportunityStage } from "@/generated/prisma/client";

interface TopOpportunitiesCardProps {
  data: TopOpportunity[];
}

function formatBRL(value: number | null): string {
  if (!value) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function TopOpportunitiesCard({ data }: TopOpportunitiesCardProps) {
  return (
    <Card className="border-border bg-card/50 rounded-xl p-6">
      <h3 className="text-base font-semibold mb-4">Top oportunidades</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem oportunidades abertas.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((o) => (
            <li key={o.id}>
              <Link
                href={`/opportunities/${o.id}/activities`}
                className="flex items-center justify-between hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {o.contactName ?? "sem contato"} • {STAGE_LABELS[o.stage as OpportunityStage] ?? o.stage}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-semibold text-violet-500">{formatBRL(o.value)}</p>
                  {o.probability !== null && (
                    <p className="text-xs text-muted-foreground">{o.probability}%</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
