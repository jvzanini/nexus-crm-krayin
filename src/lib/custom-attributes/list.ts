/**
 * Fase 5 — Custom Attributes: list cached por tenant+entity (T7/34).
 *
 * Spec v3 §3.7 — `unstable_cache` com tag `custom-attrs:<companyId>:<entity>`
 * e TTL 1h. Invalidação explícita via `revalidateTag` após CRUD (I28).
 *
 * Workers BullMQ NÃO devem usar esta função; consultam Prisma direto.
 */
import { revalidateTag, unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

import type {
  CustomAttribute,
  CustomAttributeEntity,
} from "./types";

/**
 * Lista atributos ativos de um tenant+entity, com cache por tag.
 * Filtra `status: "active"` (soft-deleted ficam "deleting" até purge).
 */
export function listCustomAttributes(
  companyId: string,
  entity: CustomAttributeEntity,
): Promise<CustomAttribute[]> {
  return unstable_cache(
    async () =>
      prisma.customAttribute.findMany({
        where: { companyId, entity, status: "active" },
        orderBy: { position: "asc" },
      }),
    ["custom-attrs", companyId, entity],
    {
      tags: [`custom-attrs:${companyId}:${entity}`],
      revalidate: 3600,
    },
  )();
}

/**
 * Invalida o cache de atributos para o par (companyId, entity).
 * Chamar após create/update/delete de CustomAttribute.
 */
export function invalidateCustomAttrsCache(
  companyId: string,
  entity: CustomAttributeEntity,
): void {
  revalidateTag(`custom-attrs:${companyId}:${entity}`, "max");
}
