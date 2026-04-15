import { z } from "zod";
import type { Locale } from "../types";

export interface ProductImportCtx {
  locale: Locale;
}

function booleanCoerce(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "sim";
}

export function productImportSchema(_ctx: ProductImportCtx) {
  return z
    .object({
      sku: z.string().min(1, "sku required").max(100),
      name: z.string().min(1, "name required").max(255),
      description: z.string().max(5000).optional(),
      category: z.string().max(100).optional(),
      active: z
        .union([z.string(), z.boolean()])
        .optional()
        .transform((v) => (v == null ? true : booleanCoerce(v))),
    })
    .passthrough();
}
