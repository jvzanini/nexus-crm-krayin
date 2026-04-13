import { parsePhoneNumberFromString, AsYouType, type CountryCode } from "libphonenumber-js/min";

const COUNTRY: CountryCode = "BR";

export function validatePhoneBR(raw: string): boolean {
  if (!raw) return false;
  const parsed = parsePhoneNumberFromString(raw, COUNTRY);
  return parsed?.isValid() ?? false;
}

export function formatPhoneBR(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw, COUNTRY);
  if (parsed?.isValid()) return parsed.formatNational();
  return raw;
}

export function maskPhoneBR(raw: string): string {
  return new AsYouType(COUNTRY).input(raw);
}
