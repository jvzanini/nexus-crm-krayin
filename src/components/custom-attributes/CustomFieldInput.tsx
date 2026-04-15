"use client";

/**
 * Fase 5 — T13a: CustomFieldInput (client).
 *
 * Renderiza o input apropriado para cada `CustomAttribute.type`, usando
 * componentes do design system Nexus (Input, Label) e UI locais
 * (Checkbox). Select/multi_select usam controles nativos acessíveis
 * (label->control via htmlFor/id) para facilitar testes e a11y.
 *
 * Spec v3 §3.10. Identidade visual: accent violet-600, erros em
 * aria-live="polite", required com asterisco visual.
 */

import { useId } from "react";
import { Input, Label } from "@nexusai360/design-system";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

type OptionDef = { value: string; label: string };

export interface CustomFieldInputProps {
  def: CustomAttribute;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  disabled?: boolean;
}

function getOptions(def: CustomAttribute): OptionDef[] {
  const raw = def.options as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is OptionDef => typeof o === "object" && o !== null && "value" in o && "label" in o)
    .map((o) => ({ value: String(o.value), label: String(o.label) }));
}

export function CustomFieldInput({
  def,
  value,
  onChange,
  error,
  disabled,
}: CustomFieldInputProps) {
  const autoId = useId();
  const controlId = `cf-${def.key}-${autoId}`;
  const helpId = `${controlId}-help`;
  const errId = `${controlId}-err`;

  const labelEl = (
    <Label htmlFor={controlId} className="text-sm font-medium">
      {def.label}
      {def.required ? (
        <span className="ml-1 text-red-600" aria-hidden="true">
          *
        </span>
      ) : null}
    </Label>
  );

  const helpEl = def.helpText ? (
    <p id={helpId} className="mt-1 text-xs text-muted-foreground">
      {def.helpText}
    </p>
  ) : null;

  const errorEl = error ? (
    <p
      id={errId}
      role="alert"
      aria-live="polite"
      className="mt-1 text-xs text-red-600"
    >
      {error}
    </p>
  ) : null;

  const describedBy =
    [def.helpText ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;

  const commonProps = {
    id: controlId,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": def.required || undefined,
  } as const;

  let control: React.ReactNode;

  switch (def.type) {
    case "text": {
      control = (
        <Input
          {...commonProps}
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={def.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }
    case "number": {
      control = (
        <Input
          {...commonProps}
          type="number"
          value={
            typeof value === "number" && Number.isFinite(value)
              ? String(value)
              : ""
          }
          placeholder={def.placeholder ?? undefined}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : null);
          }}
        />
      );
      break;
    }
    case "date": {
      control = (
        <Input
          {...commonProps}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }
    case "datetime": {
      control = (
        <Input
          {...commonProps}
          type="datetime-local"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }
    case "url": {
      control = (
        <Input
          {...commonProps}
          type="url"
          value={typeof value === "string" ? value : ""}
          placeholder={def.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    }
    case "boolean": {
      const checked = value === true;
      control = (
        <Checkbox
          id={controlId}
          disabled={disabled}
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onCheckedChange={(state) => onChange(state === true)}
        />
      );
      break;
    }
    case "select": {
      const options = getOptions(def);
      control = (
        <select
          {...commonProps}
          className={cn(
            "flex h-9 w-full min-h-[44px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-600",
          )}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {def.placeholder ?? "Selecionar"}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "multi_select": {
      const options = getOptions(def);
      const current = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div
          id={controlId}
          role="group"
          aria-describedby={describedBy}
          className="flex flex-col gap-2"
        >
          {options.map((opt) => {
            const checked = current.includes(opt.value);
            const itemId = `${controlId}-${opt.value}`;
            return (
              <label
                key={opt.value}
                htmlFor={itemId}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id={itemId}
                  disabled={disabled}
                  checked={checked}
                  onCheckedChange={(state) => {
                    const on = state === true;
                    const next = on
                      ? Array.from(new Set([...current, opt.value]))
                      : current.filter((v) => v !== opt.value);
                    onChange(next);
                  }}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    }
    default: {
      control = null;
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {labelEl}
      {control}
      {helpEl}
      {errorEl}
    </div>
  );
}
