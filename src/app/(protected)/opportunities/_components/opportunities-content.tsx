"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Opportunity, Contact } from "@/generated/prisma/client";

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecção",
  qualification: "Qualificação",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Fechado (Ganho)",
  closed_lost: "Fechado (Perdido)",
};

const STAGE_VARIANTS: Record<string, string> = {
  prospecting: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  qualification: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  proposal: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  negotiation: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  closed_won: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  closed_lost: "bg-red-500/10 text-red-400 border-red-500/20",
};

interface OpportunitiesContentProps {
  opportunities: (Opportunity & { contact: Contact | null })[];
}

export function OpportunitiesContent({ opportunities }: OpportunitiesContentProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all" ? opportunities : opportunities.filter((o) => o.stage === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 border border-violet-600/20">
            <TrendingUp className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Oportunidades</h1>
            <p className="text-sm text-muted-foreground">
              {opportunities.length} oportunidade{opportunities.length !== 1 ? "s" : ""} cadastrada{opportunities.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova oportunidade
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {["all", "prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filter === s
                ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                : "border-border text-muted-foreground hover:border-muted-foreground/30"
            }`}
          >
            {s === "all" ? "Todos" : STAGE_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {/* Lista */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      >
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhuma oportunidade encontrada
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((opp) => (
                  <div key={opp.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{opp.title}</p>
                      {opp.contact && (
                        <p className="text-xs text-muted-foreground">
                          {opp.contact.firstName} {opp.contact.lastName}
                        </p>
                      )}
                    </div>
                    {opp.value && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        R$ {Number(opp.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STAGE_VARIANTS[opp.stage] ?? ""}`}
                    >
                      {STAGE_LABELS[opp.stage] ?? opp.stage}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
