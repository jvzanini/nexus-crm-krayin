"use client";

/**
 * Fase 5 — T13c: CustomFiltersSection.
 *
 * Spec v3 §3.10 + §3.6: renderiza filtros para custom attributes marcados como
 * `searchable: true`. Para cada def: dropdown de operador (OPS_BY_TYPE) + input
 * de valor apropriado ao tipo. Colapsável (details/summary) — DS ainda não
 * expõe Collapsible, então usamos o elemento nativo mantendo acessibilidade.
 *
 * NÃO integra no FilterBar aqui (T18). Apenas emite `onApply` com
 * `Array<{key, op, value}>`.
 */

import { useState } from "react";
import { OPS_BY_TYPE, type CustomAttribute } from "@/lib/custom-attributes/types";

export interface CustomFilterValue {
  key: string;
  op: string;
  value: unknown;
}

interface FilterState {
  op: string;
  value: string;
}

interface CustomFiltersSectionProps {
  defs: CustomAttribute[];
  initialFilters?: CustomFilterValue[];
  onApply: (filters: CustomFilterValue[]) => void;
}

function defaultOp(type: CustomAttribute["type"]): string {
  const key = (type ?? "text") as keyof typeof OPS_BY_TYPE;
  const ops = OPS_BY_TYPE[key] ?? OPS_BY_TYPE.text;
  return ops[0] ?? "eq";
}

function initialStateFor(
  defs: CustomAttribute[],
  initial?: CustomFilterValue[],
): Record<string, FilterState> {
  const out: Record<string, FilterState> = {};
  for (const d of defs) {
    if (!d.searchable) continue;
    const existing = initial?.find((f) => f.key === d.key);
    out[d.key!] = {
      op: existing?.op ?? defaultOp(d.type),
      value: existing ? String(existing.value ?? "") : "",
    };
  }
  return out;
}

function inputTypeFor(type: CustomAttribute["type"]): string {
  switch (type) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "url":
      return "url";
    default:
      return "text";
  }
}

export function CustomFiltersSection({
  defs,
  initialFilters,
  onApply,
}: CustomFiltersSectionProps) {
  const searchable = defs.filter((d) => d.searchable === true);
  const [state, setState] = useState<Record<string, FilterState>>(() =>
    initialStateFor(defs, initialFilters),
  );

  function update(key: string, patch: Partial<FilterState>) {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function handleApply() {
    const filters: CustomFilterValue[] = [];
    for (const d of searchable) {
      const s = state[d.key!];
      if (!s) continue;
      // is_null dispensa value; demais precisam de value não-vazio.
      if (s.op === "is_null") {
        filters.push({ key: d.key!, op: s.op, value: null });
        continue;
      }
      if (s.value === "" || s.value == null) continue;
      let coerced: unknown = s.value;
      if (d.type === "number") {
        const n = Number(s.value);
        if (Number.isNaN(n)) continue;
        coerced = n;
      } else if (d.type === "boolean") {
        coerced = s.value === "true";
      }
      filters.push({ key: d.key!, op: s.op, value: coerced });
    }
    onApply(filters);
  }

  function handleClear() {
    const reset: Record<string, FilterState> = {};
    for (const d of searchable) {
      reset[d.key!] = { op: defaultOp(d.type), value: "" };
    }
    setState(reset);
    onApply([]);
  }

  return (
    <details
      data-testid="custom-filters-section"
      className="rounded-xl border border-border bg-card/30"
    >
      <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-medium text-foreground select-none">
        <span>Atributos customizados</span>
        <span aria-hidden className="text-muted-foreground">
          ▾
        </span>
      </summary>

      <div className="flex flex-wrap items-end gap-3 p-4 pt-0">
        {searchable.map((d) => {
          const key = d.key!;
          const s = state[key] ?? { op: defaultOp(d.type), value: "" };
          const typeKey = (d.type ?? "text") as keyof typeof OPS_BY_TYPE;
          const ops = OPS_BY_TYPE[typeKey] ?? OPS_BY_TYPE.text;

          return (
            <div
              key={key}
              className="flex flex-col gap-1 min-w-[200px]"
              data-field={key}
            >
              <label className="text-xs text-muted-foreground">{d.label}</label>
              <div className="flex gap-2">
                <select
                  data-testid={`op-${key}`}
                  value={s.op}
                  onChange={(e) => update(key, { op: e.target.value })}
                  className="h-10 rounded-md border border-border bg-muted/50 px-2 text-sm text-foreground"
                >
                  {ops.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>

                {d.type === "boolean" ? (
                  <select
                    data-testid={`val-${key}`}
                    value={s.value}
                    onChange={(e) => update(key, { value: e.target.value })}
                    disabled={s.op === "is_null"}
                    className="h-10 flex-1 rounded-md border border-border bg-muted/50 px-2 text-sm text-foreground"
                  >
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : d.type === "select" ||
                  d.type === "multi_select" ? (
                  <input
                    data-testid={`val-${key}`}
                    type="text"
                    value={s.value}
                    onChange={(e) => update(key, { value: e.target.value })}
                    disabled={s.op === "is_null"}
                    placeholder="valor(es)"
                    className="h-10 flex-1 rounded-md border border-border bg-muted/50 px-2 text-sm text-foreground"
                  />
                ) : (
                  <input
                    data-testid={`val-${key}`}
                    type={inputTypeFor(d.type)}
                    value={s.value}
                    onChange={(e) => update(key, { value: e.target.value })}
                    disabled={s.op === "is_null"}
                    className="h-10 flex-1 rounded-md border border-border bg-muted/50 px-2 text-sm text-foreground"
                  />
                )}
              </div>
            </div>
          );
        })}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="h-10 px-4 rounded-md border border-border bg-transparent text-muted-foreground text-sm hover:bg-muted/50 cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </details>
  );
}
