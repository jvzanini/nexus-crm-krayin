"use client";

/**
 * Fase 5 — T13a: CustomFieldsSection (client).
 *
 * Renderiza uma lista ordenada de CustomFieldInput para um conjunto
 * de definitions. Agrega mudanças em um único objeto `values` e
 * notifica via `onChange`.
 *
 * Spec v3 §3.10.
 */

import { useMemo } from "react";

import { CustomFieldInput } from "./CustomFieldInput";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

export interface CustomFieldsSectionProps {
  defs: CustomAttribute[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  title?: string;
}

export function CustomFieldsSection({
  defs,
  values,
  onChange,
  errors,
  disabled,
  title = "Atributos customizados",
}: CustomFieldsSectionProps) {
  const ordered = useMemo(
    () => [...defs].sort((a, b) => a.position - b.position),
    [defs],
  );

  if (ordered.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      ) : null}
      <div className="flex flex-col gap-4">
        {ordered.map((def) => (
          <CustomFieldInput
            key={def.id}
            def={def}
            value={values[def.key]}
            disabled={disabled}
            error={errors?.[def.key]}
            onChange={(v) => onChange({ ...values, [def.key]: v })}
          />
        ))}
      </div>
    </section>
  );
}
