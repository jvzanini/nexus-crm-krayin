"use client";

import { X } from "lucide-react";
import { Button, CustomSelect, Input } from "@nexusai360/design-system";
import {
  CustomFiltersSection,
  type CustomFilterValue,
} from "@/components/custom-attributes/CustomFiltersSection";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectConfig {
  type: "select";
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  placeholder?: string;
}

export interface FilterInputConfig {
  type: "input";
  key: string;
  label: string;
  placeholder?: string;
  value: string;
  inputType?: string;
}

export interface FilterDateConfig {
  type: "date";
  key: string;
  label: string;
  value: string;
}

export type FilterConfig =
  | FilterSelectConfig
  | FilterInputConfig
  | FilterDateConfig;

interface FilterBarProps {
  filters: FilterConfig[];
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  hasActive: boolean;
  /**
   * Fase 5 — T18: seção opcional de filtros por custom attributes.
   * Renderiza `CustomFiltersSection` abaixo dos filtros nativos quando
   * `defs.length > 0`. Ausência preserva comportamento backward.
   */
  customFilters?: {
    defs: CustomAttribute[];
    initialFilters?: CustomFilterValue[];
    onApply: (filters: CustomFilterValue[]) => void;
  };
}

export function FilterBar({
  filters,
  onChange,
  onClear,
  hasActive,
  customFilters,
}: FilterBarProps) {
  const showCustom =
    !!customFilters && customFilters.defs && customFilters.defs.length > 0;
  return (
    <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border bg-card/30">
      {filters.map((f) => {
        if (f.type === "select") {
          return (
            <div key={f.key} className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <CustomSelect
                value={f.value}
                onChange={(v) => onChange(f.key, v)}
                options={f.options}
                placeholder={f.placeholder}
              />
            </div>
          );
        }
        if (f.type === "input") {
          return (
            <div key={f.key} className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <Input
                value={f.value}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                type={f.inputType ?? "text"}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
          );
        }
        if (f.type === "date") {
          return (
            <div key={f.key} className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <Input
                type="date"
                value={f.value}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
          );
        }
        return null;
      })}
      {hasActive && (
        <Button
          onClick={onClear}
          className="h-10 bg-transparent hover:bg-muted/50 text-muted-foreground border border-border cursor-pointer"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar filtros
        </Button>
      )}
    </div>
    {showCustom && customFilters && (
      <CustomFiltersSection
        defs={customFilters.defs}
        initialFilters={customFilters.initialFilters}
        onApply={customFilters.onApply}
      />
    )}
    </div>
  );
}
