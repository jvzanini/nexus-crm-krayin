import { getLocalePack } from "@/locale/registry";
import type { LocaleCode, LocalePack } from "@/locale/types";

export function getPackForLocale(locale: LocaleCode): LocalePack {
  return getLocalePack(locale);
}

export function getDefaultTimezone(locale: LocaleCode): string {
  return getLocalePack(locale).timezoneDefault;
}

export function getDefaultCurrency(locale: LocaleCode): string {
  return getLocalePack(locale).currencyDefault;
}
