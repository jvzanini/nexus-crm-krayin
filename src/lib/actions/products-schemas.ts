/**
 * Schemas Zod dos filtros URL do módulo /products.
 *
 * Este arquivo NÃO é um Server Actions file — é um módulo utilitário
 * que pode ser importado tanto no server (actions) quanto no client
 * (`products-content.tsx`) para validar `searchParams` de forma unificada.
 */
import { z } from "zod";

export const ProductsFiltersSchema = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  active: z.enum(["active", "inactive"]).optional(),
  category: z.string().trim().min(1).max(64).optional(),
});

export type ProductsFilters = z.infer<typeof ProductsFiltersSchema>;
