"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardFiltersProps {
  selectedPeriod: string;
  isLoading: boolean;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
}

const periods = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export function DashboardFilters({
  selectedPeriod,
  isLoading,
  onPeriodChange,
  onRefresh,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto sm:ml-auto">
      {/* Filtro de período */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-card/80">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
              selectedPeriod === p.value
                ? "bg-violet-600 text-white shadow-[0_0_8px_rgba(124,58,237,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Botao refresh */}
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        className="h-9 w-9 rounded-lg border-border bg-card/80 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      </Button>
      </div>
    </div>
  );
}
