/**
 * Fase 5 — Custom Attributes: caps e asserções de limites.
 *
 * Spec v3 §3.10:
 * - 30 attrs por entity por tenant.
 * - 32KB aproximação JSON-encoded por row (`custom` column).
 * - 256 chars por valor em `in` / `has_*`.
 * - 50 valores máx em `in` / `has_*`.
 * - 5 filtros `cf[...]` concorrentes por request.
 */

import { prisma } from "../prisma";
import type { CustomAttributeEntity } from "../../generated/prisma/enums";

export {
  MAX_ATTRS_PER_ENTITY,
  MAX_CUSTOM_BYTES_PER_ROW,
  MAX_FILTER_VALUES,
  MAX_FILTER_VALUE_LENGTH,
  MAX_CONCURRENT_FILTERS,
  RESERVED_KEYS,
  type ReservedKey,
} from "./limits.constants";

import { MAX_ATTRS_PER_ENTITY, MAX_CUSTOM_BYTES_PER_ROW, RESERVED_KEYS } from "./limits.constants";

/**
 * Asserção: payload `custom` (JSON-encoded) cabe em 32KB por row.
 * Lança `CustomAttrBytesExceededError` se exceder.
 */
export class CustomAttrBytesExceededError extends Error {
  constructor(public actualBytes: number) {
    super(
      `custom payload excede ${MAX_CUSTOM_BYTES_PER_ROW} bytes (got ${actualBytes})`,
    );
    this.name = "CustomAttrBytesExceededError";
  }
}

export class CustomAttrReservedKeyError extends Error {
  constructor(public key: string) {
    super(`key "${key}" é reservada e não pode ser usada em custom attributes`);
    this.name = "CustomAttrReservedKeyError";
  }
}

export class CustomAttrCountExceededError extends Error {
  constructor(
    public entity: CustomAttributeEntity,
    public current: number,
  ) {
    super(
      `limite de ${MAX_ATTRS_PER_ENTITY} custom attributes por entity atingido (${entity} tem ${current})`,
    );
    this.name = "CustomAttrCountExceededError";
  }
}

export function assertCustomBytes(custom: unknown): void {
  const encoded = JSON.stringify(custom ?? {});
  const bytes = Buffer.byteLength(encoded, "utf8");
  if (bytes > MAX_CUSTOM_BYTES_PER_ROW) {
    throw new CustomAttrBytesExceededError(bytes);
  }
}

export function assertKeyNotReserved(key: string): void {
  const lower = key.toLowerCase();
  const reservedLower = (RESERVED_KEYS as readonly string[]).map((k) =>
    k.toLowerCase(),
  );
  if (reservedLower.includes(lower)) {
    throw new CustomAttrReservedKeyError(key);
  }
}

/**
 * Conta attrs ativos (status=active) para (companyId, entity) e lança se
 * ao adicionar +1 passaria de MAX_ATTRS_PER_ENTITY.
 */
export async function assertAttrCount(
  companyId: string,
  entity: CustomAttributeEntity,
): Promise<void> {
  const current = await prisma.customAttribute.count({
    where: { companyId, entity, status: "active" },
  });
  if (current >= MAX_ATTRS_PER_ENTITY) {
    throw new CustomAttrCountExceededError(entity, current);
  }
}
