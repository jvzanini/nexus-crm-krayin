"use client";

import { useState, useCallback, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { useLocaleContext } from "@/components/locale/LocaleClientProvider";

interface MoneyInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: number;
  currency?: string;
  onChange?: (cents: number) => void;
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value = 0, currency, onChange, ...props }, ref) => {
    const { locale, pack } = useLocaleContext();
    const cur = currency ?? pack.currencyDefault;

    const [display, setDisplay] = useState(() => {
      if (value === 0) return "";
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: cur,
      }).format(value / 100);
    });

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "");
        const cents = parseInt(raw || "0", 10);
        setDisplay(
          cents > 0
            ? new Intl.NumberFormat(locale, {
                style: "currency",
                currency: cur,
              }).format(cents / 100)
            : ""
        );
        onChange?.(cents);
      },
      [locale, cur, onChange]
    );

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
