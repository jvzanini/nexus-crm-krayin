"use client";

import { AVAILABLE_LOCALES, LOCALE_PACKS } from "@/locale/registry";
import { Check } from "lucide-react";
import type { LocaleCode } from "@/locale/types";

interface LocaleFieldProps {
  value: string;
  onChange: (locale: LocaleCode) => void;
  disabled?: boolean;
}

export function LocaleField({ value, onChange, disabled }: LocaleFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      {AVAILABLE_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          disabled={disabled}
          onClick={() => onChange(code)}
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors ${
            value === code
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-accent"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className="font-medium">{LOCALE_PACKS[code].name}</span>
          {value === code && <Check className="h-4 w-4 text-primary" />}
        </button>
      ))}
    </div>
  );
}
