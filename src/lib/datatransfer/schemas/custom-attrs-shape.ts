import { z } from "zod";

export interface CustomAttrSnapshot {
  key: string;
  type:
    | "text"
    | "number"
    | "date"
    | "datetime"
    | "boolean"
    | "select"
    | "multi_select"
    | "url";
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  options: string[] | null;
}

function fieldSchema(def: CustomAttrSnapshot): z.ZodType<unknown> {
  switch (def.type) {
    case "text":
    case "url": {
      let s = z.string();
      if (def.minLength != null) s = s.min(def.minLength);
      if (def.maxLength != null) s = s.max(def.maxLength);
      if (def.type === "url") s = s.url() as unknown as typeof s;
      return s;
    }
    case "number":
      return z
        .string()
        .or(z.number())
        .transform((v, ctx) => {
          const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
          if (!Number.isFinite(n)) {
            ctx.addIssue({ code: "custom", message: "invalid number" });
            return z.NEVER;
          }
          return n;
        });
    case "boolean":
      return z
        .string()
        .or(z.boolean())
        .transform((v) => {
          if (typeof v === "boolean") return v;
          const s = String(v).toLowerCase().trim();
          return s === "true" || s === "1" || s === "yes" || s === "sim";
        });
    case "date":
    case "datetime":
      return z.string().transform((v, ctx) => {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          ctx.addIssue({ code: "custom", message: "invalid date" });
          return z.NEVER;
        }
        return d.toISOString();
      });
    case "select": {
      const opts = def.options ?? [];
      return z
        .string()
        .refine((v) => opts.includes(v), {
          message: `value not in options: ${opts.join(",")}`,
        });
    }
    case "multi_select": {
      const opts = def.options ?? [];
      return z.string().transform((v, ctx) => {
        const parts = v
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const bad = parts.filter((p) => !opts.includes(p));
        if (bad.length > 0) {
          ctx.addIssue({
            code: "custom",
            message: `values not in options: ${bad.join(",")}`,
          });
          return z.NEVER;
        }
        return parts;
      });
    }
    default:
      return z.string();
  }
}

/**
 * Gera Zod object a partir de um snapshot de `CustomAttributeDef[]`.
 * Campos required entram como obrigatórios; demais como opcionais.
 * O output é validado por key; valores inválidos rejeitam a linha.
 */
export function dynamicCustomShape(
  defs: CustomAttrSnapshot[],
): z.ZodObject<Record<string, z.ZodType<unknown>>> {
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const def of defs) {
    const base = fieldSchema(def);
    shape[def.key] = def.required ? base : base.optional();
  }
  return z.object(shape);
}
