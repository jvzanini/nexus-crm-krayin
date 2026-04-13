import { useMemo } from "react";
import { useLocaleContext } from "@/components/locale/LocaleClientProvider";

export interface LocaleFormatters {
  formatMoney: (amountCents: bigint | number, currency?: string) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | string, timezone?: string) => string;
  formatPhone: (raw: string) => string;
  formatTaxIdPersonal: (raw: string) => string;
  formatTaxIdBusiness: (raw: string) => string;
  formatPostalCode: (raw: string) => string;
}

export function useLocaleFormatters(): LocaleFormatters {
  const { locale, pack } = useLocaleContext();

  return useMemo<LocaleFormatters>(() => ({
    formatMoney(amountCents, currency) {
      const cur = currency ?? pack.currencyDefault;
      const amount = typeof amountCents === "bigint"
        ? Number(amountCents) / 100
        : amountCents / 100;
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: cur,
      }).format(amount);
    },

    formatDate(date, options) {
      const d = typeof date === "string" ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...options,
      }).format(d);
    },

    formatDateTime(date, timezone) {
      const d = typeof date === "string" ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone ?? pack.timezoneDefault,
      }).format(d);
    },

    formatPhone: (raw) => pack.rules.formatPhone(raw),
    formatTaxIdPersonal: (raw) => pack.rules.formatTaxIdPersonal(raw),
    formatTaxIdBusiness: (raw) => pack.rules.formatTaxIdBusiness(raw),
    formatPostalCode: (raw) => pack.rules.formatPostalCode(raw),
  }), [locale, pack]);
}
