"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePack } from "@/hooks/locale/usePack";

interface TimezoneComboboxProps {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone");

export function TimezoneCombobox({ value, onChange, disabled }: TimezoneComboboxProps) {
  const pack = usePack();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const recommended = new Set(pack.recommendedTimezones);
    const q = search.toLowerCase();
    const all = q ? ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(q)) : ALL_TIMEZONES;
    const rec = all.filter((tz) => recommended.has(tz));
    const rest = all.filter((tz) => !recommended.has(tz));
    return { recommended: rec, others: rest };
  }, [search, pack.recommendedTimezones]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {value || "Selecionar fuso..."}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-border bg-popover shadow-xl shadow-black/20"
          >
            <div className="sticky top-0 bg-popover p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar fuso..."
                  className="h-8 pl-8"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-1">
              {filtered.recommended.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Recomendados</div>
                  {filtered.recommended.map((tz) => (
                    <button
                      key={tz}
                      onClick={() => { onChange(tz); setOpen(false); setSearch(""); }}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <span>{tz}</span>
                      {value === tz && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </>
              )}
              {filtered.others.length > 0 && (
                <>
                  {filtered.recommended.length > 0 && (
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Outros</div>
                  )}
                  {filtered.others.slice(0, 20).map((tz) => (
                    <button
                      key={tz}
                      onClick={() => { onChange(tz); setOpen(false); setSearch(""); }}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <span>{tz}</span>
                      {value === tz && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                  {filtered.others.length > 20 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">
                      +{filtered.others.length - 20} resultados. Refine a busca.
                    </div>
                  )}
                </>
              )}
              {filtered.recommended.length === 0 && filtered.others.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum resultado</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
