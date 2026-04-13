"use client";

import { createContext, useContext, useMemo } from "react";
import { getLocalePack, AVAILABLE_LOCALES } from "@/locale/registry";
import type { LocaleCode, LocalePack } from "@/locale/types";

interface LocaleContextValue {
  locale: LocaleCode;
  pack: LocalePack;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocaleCode(value: string): value is LocaleCode {
  return AVAILABLE_LOCALES.includes(value as LocaleCode);
}

export function LocaleClientProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const safeLocale: LocaleCode = isLocaleCode(locale) ? locale : "pt-BR";
  const pack = useMemo(() => getLocalePack(safeLocale), [safeLocale]);

  return (
    <LocaleContext.Provider value={{ locale: safeLocale, pack }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocaleContext must be used within LocaleClientProvider");
  }
  return ctx;
}
