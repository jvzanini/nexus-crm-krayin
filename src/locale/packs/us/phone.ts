import { parsePhoneNumberFromString, AsYouType, type CountryCode } from "libphonenumber-js/min";

const COUNTRY: CountryCode = "US";

export function validatePhoneUS(raw: string): boolean {
  if (!raw) return false;
  return parsePhoneNumberFromString(raw, COUNTRY)?.isValid() ?? false;
}

export function formatPhoneUS(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw, COUNTRY);
  return parsed?.isValid() ? parsed.formatNational() : raw;
}

export function maskPhoneUS(raw: string): string {
  return new AsYouType(COUNTRY).input(raw);
}
