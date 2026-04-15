import { z } from "zod";
import type { Locale } from "../types";
import { moneyCoerce } from "../coerce";
import {
  dynamicCustomShape,
  type CustomAttrSnapshot,
} from "./custom-attrs-shape";

export interface OpportunityImportCtx {
  locale: Locale;
  customAttrDefs: CustomAttrSnapshot[];
  lookupStage?: (label: string) => string | null;
}

const STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export function opportunityImportSchema(ctx: OpportunityImportCtx) {
  const custom = dynamicCustomShape(ctx.customAttrDefs);
  return z
    .object({
      title: z.string().min(1).max(255),
      stage: z
        .string()
        .optional()
        .transform((v, c) => {
          if (!v) return "prospecting" as const;
          const resolved =
            ctx.lookupStage?.(v) ??
            ((STAGES as readonly string[]).includes(v) ? v : null);
          if (!resolved || !(STAGES as readonly string[]).includes(resolved)) {
            c.addIssue({ code: "custom", message: `stage inválida: ${v}` });
            return z.NEVER;
          }
          return resolved as (typeof STAGES)[number];
        }),
      value: moneyCoerce(ctx.locale.decimalSep).optional(),
      currency: z.string().max(3).default("BRL"),
      probability: z.coerce.number().int().min(0).max(100).optional(),
      closeDate: z
        .string()
        .transform((v, c) => {
          if (!v) return undefined;
          const d = new Date(v);
          if (Number.isNaN(d.getTime())) {
            c.addIssue({ code: "custom", message: "closeDate inválido" });
            return z.NEVER;
          }
          return d;
        })
        .optional(),
      notes: z.string().max(5000).optional(),
      custom: custom.optional(),
    })
    .passthrough();
}
