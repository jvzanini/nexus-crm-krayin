import { z } from "zod";
import type { Locale } from "../types";
import {
  dynamicCustomShape,
  type CustomAttrSnapshot,
} from "./custom-attrs-shape";

export interface LeadImportCtx {
  locale: Locale;
  customAttrDefs: CustomAttrSnapshot[];
  lookupOwner?: (labelOrEmail: string) => Promise<string | null>;
  lookupStatus?: (labelOrValue: string) => string | null;
}

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
] as const;

export function leadImportSchema(ctx: LeadImportCtx) {
  const custom = dynamicCustomShape(ctx.customAttrDefs);
  return z
    .object({
      name: z.string().min(1, "name is required").max(255),
      email: z.string().email().max(255).optional().or(z.literal("").transform(() => undefined)),
      phone: z.string().max(50).optional(),
      company: z.string().max(255).optional(),
      source: z.string().max(100).optional(),
      status: z
        .string()
        .optional()
        .transform((v, c) => {
          if (!v) return "new" as const;
          const resolved =
            ctx.lookupStatus?.(v) ?? (LEAD_STATUSES as readonly string[]).includes(v)
              ? ctx.lookupStatus?.(v) ?? v
              : null;
          if (!resolved) {
            c.addIssue({ code: "custom", message: `status inválido: ${v}` });
            return z.NEVER;
          }
          if (!(LEAD_STATUSES as readonly string[]).includes(resolved)) {
            c.addIssue({ code: "custom", message: `status fora do enum: ${resolved}` });
            return z.NEVER;
          }
          return resolved as (typeof LEAD_STATUSES)[number];
        }),
      notes: z.string().max(5000).optional(),
      assignedTo: z.string().optional(),
      custom: custom.optional(),
    })
    .passthrough();
}
