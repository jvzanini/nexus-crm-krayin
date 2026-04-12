"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/generated/prisma/client";

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  contacted: "Contactado",
  qualified: "Qualificado",
  unqualified: "Não qualificado",
  converted: "Convertido",
};

const STATUS_VARIANTS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  qualified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  unqualified: "bg-red-500/10 text-red-400 border-red-500/20",
  converted: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

interface LeadsContentProps {
  leads: Lead[];
}

export function LeadsContent({ leads }: LeadsContentProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 border border-violet-600/20">
            <Target className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">
              {leads.length} lead{leads.length !== 1 ? "s" : ""} cadastrado{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo lead
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {["all", "new", "contacted", "qualified", "unqualified", "converted"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filter === s
                ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                : "border-border text-muted-foreground hover:border-muted-foreground/30"
            }`}
          >
            {s === "all" ? "Todos" : STATUS_LABELS[s]}
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
                Nenhum lead encontrado
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((lead) => (
                  <div key={lead.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                      {lead.email && (
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      )}
                    </div>
                    {lead.company && (
                      <span className="text-xs text-muted-foreground hidden sm:block">{lead.company}</span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_VARIANTS[lead.status]}`}
                    >
                      {STATUS_LABELS[lead.status]}
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
