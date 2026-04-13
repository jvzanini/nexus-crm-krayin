import type { CountryCode } from "libphonenumber-js";

export type LocaleCode = "pt-BR" | "en-US";

export type AddressField =
  | "line1"
  | "line2"
  | "neighborhood"
  | "city"
  | "state"
  | "postalCode";

type FormatFn = (raw: string) => string;
type ValidateFn = (raw: string) => boolean;

export interface LocalePack {
  code: LocaleCode;
  name: string;
  timezoneDefault: string;
  currencyDefault: string;
  phoneDefaultCountry: CountryCode;

  recommendedTimezones: ReadonlyArray<string>;
  recommendedCurrencies: ReadonlyArray<string>;

  rules: {
    validateTaxIdPersonal: ValidateFn;
    validateTaxIdBusiness: ValidateFn;
    validatePostalCode: ValidateFn;
    validatePhone: ValidateFn;
    formatTaxIdPersonal: FormatFn;
    formatTaxIdBusiness: FormatFn;
    formatPostalCode: FormatFn;
    formatPhone: FormatFn;
    maskPhone: FormatFn;
    taxIdPersonalMaxDigits: number;
    taxIdBusinessMaxDigits: number;
    postalCodeMaxDigits: number;
  };

  address: {
    visibleFields: ReadonlyArray<AddressField>;
    requiredFields: ReadonlyArray<AddressField>;
    labelKey: Record<AddressField, string>;
    states: ReadonlyArray<{ code: string; name: string }>;
  };

  taxIdLabels: {
    personalLabelKey: string;
    businessLabelKey: string;
  };
}
