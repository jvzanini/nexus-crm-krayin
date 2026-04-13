export const TAX_ID_PERSONAL_MAX_DIGITS = 9;
export const TAX_ID_BUSINESS_MAX_DIGITS = 9;
export const POSTAL_CODE_MAX_DIGITS = 9;

export function validateSSN(raw: string): boolean {
  const ssn = raw.replace(/\D/g, "");
  if (ssn.length !== 9) return false;
  const area = ssn.slice(0, 3);
  const group = ssn.slice(3, 5);
  const serial = ssn.slice(5);
  if (area === "000" || area === "666") return false;
  if (area.startsWith("9")) return false;
  if (group === "00" || serial === "0000") return false;
  return true;
}

export function validateEIN(raw: string): boolean {
  const ein = raw.replace(/\D/g, "");
  return ein.length === 9;
}

export function validateZIP(raw: string): boolean {
  const zip = raw.replace(/\D/g, "");
  return zip.length === 5 || zip.length === 9;
}

export function formatSSN(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function formatEIN(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) return raw;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function formatZIP(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return raw;
}
