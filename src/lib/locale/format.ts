import { getLocalePack } from "@/locale/registry";
import type { LocaleCode } from "@/locale/types";

export function formatMoney(
  amountCents: number,
  locale: LocaleCode,
  currencyOverride?: string
): string {
  const pack = getLocalePack(locale);
  const currency = currencyOverride ?? pack.currencyDefault;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export function formatDate(
  date: Date | string,
  locale: LocaleCode,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(d);
}

export function formatDateTime(
  date: Date | string,
  locale: LocaleCode,
  timezone?: string
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pack = getLocalePack(locale);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone ?? pack.timezoneDefault,
  }).format(d);
}

export function formatPhone(raw: string, locale: LocaleCode): string {
  return getLocalePack(locale).rules.formatPhone(raw);
}

export function formatTaxIdPersonal(raw: string, locale: LocaleCode): string {
  return getLocalePack(locale).rules.formatTaxIdPersonal(raw);
}

export function formatTaxIdBusiness(raw: string, locale: LocaleCode): string {
  return getLocalePack(locale).rules.formatTaxIdBusiness(raw);
}

export function formatPostalCode(raw: string, locale: LocaleCode): string {
  return getLocalePack(locale).rules.formatPostalCode(raw);
}
