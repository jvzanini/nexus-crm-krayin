"use client";

import { motion } from "framer-motion";
import { Target, Users, TrendingUp, Percent, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats } from "@/lib/actions/dashboard";

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Leads",
      value: stats.totalLeads.toLocaleString("pt-BR"),
      comparison: stats.comparison.totalLeads,
      icon: Target,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
      invertTrend: false,
    },
    {
      label: "Contatos",
      value: stats.totalContacts.toLocaleString("pt-BR"),
      comparison: stats.comparison.totalContacts,
      icon: Users,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      invertTrend: false,
    },
    {
      label: "Oportunidades Abertas",
      value: stats.openOpportunities.toLocaleString("pt-BR"),
      comparison: stats.comparison.openOpportunities,
      icon: TrendingUp,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      invertTrend: false,
    },
    {
      label: "Taxa de Conversao",
      value: stats.conversionRate !== null
        ? `${stats.conversionRate.toFixed(1)}%`
        : "\u2014",
      comparison: stats.comparison.conversionRate,
      icon: Percent,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
      invertTrend: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const isPositive = card.comparison !== null && card.comparison > 0;
        const isNegative = card.comparison !== null && card.comparison < 0;
        const trendIsGood = card.invertTrend ? isNegative : isPositive;
        const trendIsBad = card.invertTrend ? isPositive : isNegative;

        return (
          <motion.div key={card.label} variants={itemVariants}>
            <Card className="bg-card border border-border hover:border-muted-foreground/30 transition-all duration-200 rounded-xl cursor-default">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                    <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    {card.comparison === null ? (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                        Novo
                      </Badge>
                    ) : (
                      <span className={trendIsGood ? "text-emerald-400" : trendIsBad ? "text-red-400" : "text-muted-foreground"}>
                        <span className="inline-flex items-center gap-0.5">
                          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : isNegative ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                          {card.comparison > 0 ? "+" : ""}{card.comparison.toFixed(1)}%
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
