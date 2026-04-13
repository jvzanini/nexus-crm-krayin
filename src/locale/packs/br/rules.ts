export const TAX_ID_PERSONAL_MAX_DIGITS = 11;
export const TAX_ID_BUSINESS_MAX_DIGITS = 14;
export const POSTAL_CODE_MAX_DIGITS = 8;

export function validateCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(cpf[i]) * (t + 1 - i);
    const rest = (sum * 10) % 11;
    if ((rest === 10 ? 0 : rest) !== Number(cpf[t])) return false;
  }
  return true;
}

export function validateCNPJ(raw: string): boolean {
  const cnpj = raw.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const check = (w: number[]) => {
    let sum = 0;
    for (let i = 0; i < w.length; i++) sum += Number(cnpj[i]) * w[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  if (check(weights1) !== Number(cnpj[12])) return false;
  if (check(weights2) !== Number(cnpj[13])) return false;
  return true;
}

export function validateCEP(raw: string): boolean {
  const cep = raw.replace(/\D/g, "");
  return cep.length === 8;
}

export function formatCPF(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return raw;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return raw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatCEP(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return raw;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
