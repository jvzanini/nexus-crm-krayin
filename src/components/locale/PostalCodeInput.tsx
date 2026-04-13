"use client";

import { useState, useCallback, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { usePack } from "@/hooks/locale/usePack";

interface PostalCodeInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onChange?: (digits: string, formatted: string, isValid: boolean) => void;
}

const PostalCodeInput = forwardRef<HTMLInputElement, PostalCodeInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const pack = usePack();
    const [display, setDisplay] = useState(() =>
      value ? pack.rules.formatPostalCode(value) : ""
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, pack.rules.postalCodeMaxDigits);
        const formatted = pack.rules.formatPostalCode(raw);
        setDisplay(formatted);
        const isValid = pack.rules.validatePostalCode(raw);
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
        maxLength={pack.rules.postalCodeMaxDigits + 1}
        {...props}
      />
    );
  }
);
PostalCodeInput.displayName = "PostalCodeInput";

export { PostalCodeInput };
