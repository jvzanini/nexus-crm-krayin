/**
 * Fase 5 — Custom Attributes: validator Zod dinâmico.
 *
 * Spec v3 §3.2/§3.4 — monta um `z.object` strict a partir da lista de
 * `CustomAttribute` definitions registradas para (tenant, entity) e valida
 * o payload `custom` vindo do cliente.
 *
 * Notas:
 * - `piiMasked: true` NÃO afeta validação (shape/range iguais). O flag é
 *   consumido por camadas de logging para redact valores em eventos.
 * - Reserved keys são rejeitadas em tempo de build do schema (fail-fast),
 *   porque indicam metadata corrompido no banco (fonte de dados interna),
 *   não input do usuário.
 * - Strict mode (`.strict()`) impede chaves extras — proteção contra
 *   writes de campos não declarados.
 */

import { z } from "zod";
import type { CustomAttribute } from "./types";
import { assertKeyNotReserved } from "./limits";

/**
 * Shape Zod das options de select/multi_select no metadata.
 * Exported para permitir validação standalone em outros módulos.
 */
export const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const selectOptionsSchema = z.array(selectOptionSchema).min(1);

/**
 * Type narrow para options parseadas. Lança se shape inválido.
 */
function parseOptions(
  raw: CustomAttribute["options"],
): Array<{ value: string; label: string }> {
  const parsed = selectOptionsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `options shape inválido para select/multi_select: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function baseSchemaFor(def: CustomAttribute): z.ZodTypeAny {
  switch (def.type) {
    case "text": {
      const max = def.maxLength ?? 500;
      return z.string().max(max);
    }
    case "number": {
      // Prisma Decimal pode chegar como string — coerce aceita ambos.
      return z.coerce.number();
    }
    case "date": {
      return z.string().regex(DATE_REGEX, "expected YYYY-MM-DD");
    }
    case "datetime": {
      return z.string().datetime();
    }
    case "boolean": {
      return z.boolean();
    }
    case "select": {
      const opts = parseOptions(def.options);
      const values = opts.map((o) => o.value) as [string, ...string[]];
      return z.enum(values);
    }
    case "multi_select": {
      const opts = parseOptions(def.options);
      const values = opts.map((o) => o.value) as [string, ...string[]];
      return z.array(z.enum(values)).max(opts.length);
    }
    case "url": {
      return z.string().url();
    }
    default: {
      // Exaustividade: novos tipos obrigam atualização explícita.
      const _exhaustive: never = def.type;
      throw new Error(`tipo não suportado: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Monta um schema Zod strict para validar o payload `custom`
 * (Record<key, value>) contra as definitions registradas.
 */
export function buildZodFromDefinitions(
  defs: CustomAttribute[],
): z.ZodSchema<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const def of defs) {
    // Reserved keys em metadata são erro interno — fail-fast.
    assertKeyNotReserved(def.key);

    let schema = baseSchemaFor(def);
    if (!def.required) {
      schema = schema.nullable().optional();
    }
    shape[def.key] = schema;
  }

  return z.object(shape).strict() as unknown as z.ZodSchema<
    Record<string, unknown>
  >;
}
