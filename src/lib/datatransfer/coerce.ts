import { z } from "zod";
import type { Locale } from "./types";

type DateFormat = Locale["dateFormat"];
type DecimalSep = Locale["decimalSep"];

function parseBr(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const mon = Number(mm);
  const year = Number(yyyy);
  const d = new Date(Date.UTC(year, mon - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== mon - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

function parseUs(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const day = Number(dd);
  const mon = Number(mm);
  const year = Number(yyyy);
  const d = new Date(Date.UTC(year, mon - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== mon - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

function parseIso(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Zod schema que aceita string e converte para `Date` segundo o formato
 * do locale. Rejeita dias/meses inválidos explicitamente (não cai no
 * auto-rollover do `Date`).
 */
export function dateCoerce(format: DateFormat): z.ZodType<Date, string> {
  return z.string().transform((s, ctx) => {
    const parser = format === "iso" ? parseIso : format === "br" ? parseBr : parseUs;
    const d = parser(s);
    if (!d) {
      ctx.addIssue({
        code: "custom",
        message: `invalid date for format ${format}`,
      });
      return z.NEVER;
    }
    return d;
  });
}

/**
 * Zod schema que aceita string monetária e converte para number. Remove
 * separador de milhar, normaliza decimal para `.`.
 */
export function moneyCoerce(sep: DecimalSep): z.ZodType<number, string> {
  return z.string().transform((raw, ctx) => {
    const s = raw.trim();
    if (s.length === 0) {
      ctx.addIssue({ code: "custom", message: "empty money" });
      return z.NEVER;
    }
    let normalized: string;
    if (sep === ",") {
      // BR: thousands '.', decimal ','
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US/ISO: thousands ',', decimal '.'
      normalized = s.replace(/,/g, "");
    }
    const n = Number(normalized);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: `invalid money: ${raw}` });
      return z.NEVER;
    }
    return n;
  });
}
