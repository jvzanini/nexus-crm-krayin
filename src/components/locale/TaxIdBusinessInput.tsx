"use client";

import { useState, useCallback, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { usePack } from "@/hooks/locale/usePack";

interface TaxIdBusinessInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onChange?: (digits: string, formatted: string, isValid: boolean) => void;
}

const TaxIdBusinessInput = forwardRef<HTMLInputElement, TaxIdBusinessInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const pack = usePack();
    const [display, setDisplay] = useState(() =>
      value ? pack.rules.formatTaxIdBusiness(value) : ""
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, pack.rules.taxIdBusinessMaxDigits);
        const formatted = pack.rules.formatTaxIdBusiness(raw);
        setDisplay(formatted);
        const isValid = pack.rules.validateTaxIdBusiness(raw);
        onChange?.(raw, formatted, isValid);
      },
      [pack.rules, onChange]
    );

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        maxLength={pack.rules.taxIdBusinessMaxDigits + 5}
        {...props}
      />
    );
  }
);
TaxIdBusinessInput.displayName = "TaxIdBusinessInput";

export { TaxIdBusinessInput };
