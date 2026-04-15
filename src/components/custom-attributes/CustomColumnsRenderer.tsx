"use client";

/**
 * Fase 5 — T13b/34: CustomColumnsRenderer.
 *
 * Renderiza células <td> para cada custom attribute `visibleInList` de
 * uma linha de tabela, aplicando formatação por tipo (spec v3 §3.10).
 *
 * Props:
 *  - defs: CustomAttribute[]           — definições ordenadas (já filtradas por entity).
 *  - customValues: Record<string, unknown> — valores crus do registro.
 *
 * Contrato: retorna um Fragment com <td> por defs.visibleInList=true.
 * Valores ausentes/null/undefined renderizam "—" (em-dash).
 */

import { Badge } from "@/components/ui/badge";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

const DASH = "—";
const TEXT_TRUNCATE = 40;

type Option = { value: string; label: string };

function getOptions(def: CustomAttribute): Option[] {
  const raw = def.options as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is Option =>
      !!o &&
      typeof o === "object" &&
      typeof (o as Option).value === "string" &&
      typeof (o as Option).label === "string",
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function formatText(value: unknown): string {
  const s = typeof value === "string" ? value : String(value);
  return truncate(s, TEXT_TRUNCATE);
}

function formatNumber(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatDate(value: unknown): string {
  const s = String(value);
  // YYYY-MM-DD only: evita shift de timezone tratando como local-date.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (match) {
    const [, y, m, d] = match;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) {
      return new Intl.DateTimeFormat("pt-BR").format(dt);
    }
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return new Intl.DateTimeFormat("pt-BR").format(dt);
}

function formatDateTime(value: unknown): string {
  const s = String(value);
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(dt);
}

/**
 * Célula única para um custom attribute.
 *
 * Encapsula o switch de tipo e retorna um <td>. Extraída para reduzir
 * complexidade do mapper no componente de topo.
 */
function CustomCell({
  def,
  value,
}: {
  def: CustomAttribute;
  value: unknown;
}) {
  if (value === null || value === undefined) {
    return <td data-key={def.key}>{DASH}</td>;
  }

  switch (def.type) {
    case "text":
    case "url":
      return <td data-key={def.key}>{formatText(value)}</td>;

    case "number":
      return <td data-key={def.key}>{formatNumber(value)}</td>;

    case "date":
      return <td data-key={def.key}>{formatDate(value)}</td>;

    case "datetime":
      return <td data-key={def.key}>{formatDateTime(value)}</td>;

    case "boolean":
      return (
        <td data-key={def.key}>
          {value ? (
            <Badge
              data-bool="true"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              Sim
            </Badge>
          ) : (
            <Badge
              data-bool="false"
              variant="destructive"
            >
              Não
            </Badge>
          )}
        </td>
      );

    case "select": {
      const options = getOptions(def);
      const match = options.find((o) => o.value === value);
      return <td data-key={def.key}>{match ? match.label : String(value)}</td>;
    }

    case "multi_select": {
      const options = getOptions(def);
      const selected = Array.isArray(value) ? value : [];
      return (
        <td data-key={def.key}>
          <div className="flex flex-wrap gap-1">
            {selected.map((v) => {
              const key = String(v);
              const match = options.find((o) => o.value === key);
              return (
                <Badge key={key} variant="secondary" data-pill="true">
                  {match ? match.label : key}
                </Badge>
              );
            })}
          </div>
        </td>
      );
    }

    default:
      return <td data-key={def.key}>{String(value)}</td>;
  }
}

export function CustomColumnsRenderer({
  defs,
  customValues,
}: {
  defs: CustomAttribute[];
  customValues: Record<string, unknown>;
}) {
  return (
    <>
      {defs
        .filter((d) => d.visibleInList)
        .map((def) => (
          <CustomCell key={def.id} def={def} value={customValues[def.key]} />
        ))}
    </>
  );
}
