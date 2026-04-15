import { z } from "zod";
import type { Locale } from "../types";
import {
  dynamicCustomShape,
  type CustomAttrSnapshot,
} from "./custom-attrs-shape";

export interface ContactImportCtx {
  locale: Locale;
  customAttrDefs: CustomAttrSnapshot[];
}

export function contactImportSchema(ctx: ContactImportCtx) {
  const custom = dynamicCustomShape(ctx.customAttrDefs);
  return z
    .object({
      firstName: z.string().min(1, "firstName required").max(100),
      lastName: z.string().min(1, "lastName required").max(100),
      email: z
        .string()
        .email()
        .max(255)
        .optional()
        .or(z.literal("").transform(() => undefined)),
      phone: z.string().max(50).optional(),
      organization: z.string().max(255).optional(),
      title: z.string().max(255).optional(),
      notes: z.string().max(5000).optional(),
      custom: custom.optional(),
    })
    .passthrough();
}
