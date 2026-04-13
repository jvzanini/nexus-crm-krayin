import { useMemo } from "react";
import { useLocaleContext } from "@/components/locale/LocaleClientProvider";

export interface LocaleValidators {
  validateTaxIdPersonal: (raw: string) => boolean;
  validateTaxIdBusiness: (raw: string) => boolean;
  validatePostalCode: (raw: string) => boolean;
  validatePhone: (raw: string) => boolean;
}

export function useLocaleValidators(): LocaleValidators {
  const { pack } = useLocaleContext();

  return useMemo<LocaleValidators>(() => ({
    validateTaxIdPersonal: pack.rules.validateTaxIdPersonal,
    validateTaxIdBusiness: pack.rules.validateTaxIdBusiness,
    validatePostalCode: pack.rules.validatePostalCode,
    validatePhone: pack.rules.validatePhone,
  }), [pack]);
}
