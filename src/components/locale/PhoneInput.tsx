"use client";

import { useState, useCallback, forwardRef } from "react";
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Input } from "@/components/ui/input";
import { usePack } from "@/hooks/locale/usePack";

interface PhoneInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onChange?: (e164: string, display: string) => void;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const pack = usePack();
    const [display, setDisplay] = useState(() => {
      if (value) {
        const parsed = parsePhoneNumberFromString(value, pack.phoneDefaultCountry);
        return parsed?.isValid() ? parsed.formatNational() : value;
      }
      return "";
    });

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const masked = new AsYouType(pack.phoneDefaultCountry).input(raw);
        setDisplay(masked);

        const parsed = parsePhoneNumberFromString(raw, pack.phoneDefaultCountry);
        const e164 = parsed?.isValid() ? parsed.format("E.164") : raw.replace(/\D/g, "");
        onChange?.(e164, masked);
      },
      [pack.phoneDefaultCountry, onChange]
    );

    return (
      <Input
        ref={ref}
        type="tel"
        value={display}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
