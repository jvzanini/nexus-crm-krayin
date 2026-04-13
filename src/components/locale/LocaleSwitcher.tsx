"use client";

import { useTransition } from "react";
import { useLocaleContext } from "@/components/locale/LocaleClientProvider";
import { LOCALE_PACKS, AVAILABLE_LOCALES } from "@/locale/registry";
import { setUserLocale } from "@/lib/actions/locale";
import { Button } from "@/components/ui/button";
import { Globe, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export function LocaleSwitcher() {
  const { locale } = useLocaleContext();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(code: string) {
    setOpen(false);
    startTransition(() => {
      setUserLocale(code);
    });
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="text-muted-foreground hover:text-foreground"
      >
        <Globe className="h-4 w-4" />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-xl shadow-black/20"
          >
            {AVAILABLE_LOCALES.map((code) => (
              <button
                key={code}
                onClick={() => handleSelect(code)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <span>{LOCALE_PACKS[code].name}</span>
                {code === locale && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
