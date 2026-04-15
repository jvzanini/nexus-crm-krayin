/**
 * Schemas Zod do módulo Saved Filters (Fase 33).
 *
 * Importado tanto pelo server (actions) quanto pelo client (hook + componentes).
 */
import { z } from "zod";

export const SavedFilterModuleZ = z.enum([
  "leads",
  "contacts",
  "opportunities",
  "products",
  "tasks",
  "campaigns",
  "segments",
  "workflows",
]);

export type SavedFilterModuleKey = z.infer<typeof SavedFilterModuleZ>;

/**
 * Payload opaco de filtros — somente `Record<string,string>`. A validação
 * contra o schema de cada módulo é feita no consumo (content client).
 */
const FiltersPayloadZ = z.record(z.string(), z.string()).default({});

export const SaveFilterSchema = z.object({
  moduleKey: SavedFilterModuleZ,
  name: z.string().trim().min(1).max(80),
  filters: FiltersPayloadZ,
  setAsDefault: z.boolean().optional(),
});

export const UpdateFilterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  filters: FiltersPayloadZ.optional(),
  setAsDefault: z.boolean().optional(),
});

export const SetDefaultSchema = z.object({
  moduleKey: SavedFilterModuleZ,
  id: z.string().uuid(),
});

export type SaveFilterInput = z.infer<typeof SaveFilterSchema>;
export type UpdateFilterInput = z.infer<typeof UpdateFilterSchema>;
export type SetDefaultInput = z.infer<typeof SetDefaultSchema>;
