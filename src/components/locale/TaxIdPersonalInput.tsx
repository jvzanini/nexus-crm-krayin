"use client";

import { useState, useCallback, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { usePack } from "@/hooks/locale/usePack";

interface TaxIdPersonalInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onChange?: (digits: string, formatted: string, isValid: boolean) => void;
}

const TaxIdPersonalInput = forwardRef<HTMLInputElement, TaxIdPersonalInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const pack = usePack();
    const [display, setDisplay] = useState(() =>
      value ? pack.rules.formatTaxIdPersonal(value) : ""
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, pack.rules.taxIdPersonalMaxDigits);
        const formatted = pack.rules.formatTaxIdPersonal(raw);
        setDisplay(formatted);
        const isValid = pack.rules.validateTaxIdPersonal(raw);
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
        maxLength={pack.rules.taxIdPersonalMaxDigits + 4}
        {...props}
      />
    );
  }
);
TaxIdPersonalInput.displayName = "TaxIdPersonalInput";

export { TaxIdPersonalInput };
