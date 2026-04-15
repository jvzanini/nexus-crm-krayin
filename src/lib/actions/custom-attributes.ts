"use server";

/**
 * Fase 5 — Custom Attributes: server actions list/get/create (T8a/34).
 *
 * Spec v3 §4 — RBAC matrix, caps (30/entity), reserved keys, revalidateTag,
 * auditLog. Update/delete/reorder ficam em T8b/T8c.
 */

import { z } from "zod";
import { revalidateTag } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import {
  requireActiveCompanyId,
  NoActiveCompanyError,
} from "@/lib/tenant-scope";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import {
  assertAttrCount,
  assertKeyNotReserved,
  CustomAttrCountExceededError,
  CustomAttrReservedKeyError,
} from "@/lib/custom-attributes/limits";
import { selectOptionsSchema } from "@/lib/custom-attributes/validator";
import { auditLog } from "@/lib/audit-log";
import { ActorType } from "@/generated/prisma/client";
import type {
  CustomAttribute,
  CustomAttributeEntity,
} from "@/lib/custom-attributes/types";
import { logger } from "@/lib/logger";
import {
  enqueueCreateIndex,
  enqueueDropIndex,
  enqueuePurgeValues,
} from "@/lib/worker/queues/custom-attr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

const KEY_REGEX = /^[a-z][a-z0-9_]{1,79}$/;

const entitySchema = z.enum(["lead", "contact", "opportunity"]);
const typeSchema = z.enum([
  "text",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "multi_select",
  "url",
]);

/**
 * Schema Zod para input de criação. `options` validado por `selectOptionsSchema`
 * quando type ∈ {select, multi_select}.
 */
export const createCustomAttributeSchema = z
  .object({
    entity: entitySchema,
    key: z
      .string()
      .regex(
        KEY_REGEX,
        "key deve começar com letra minúscula e conter apenas [a-z0-9_]",
      ),
    label: z.string().min(1).max(120),
    type: typeSchema,
    required: z.boolean().default(false),
    isUnique: z.boolean().default(false),
    options: z.unknown().optional(),
    defaultValue: z.unknown().optional(),
    placeholder: z.string().max(200).nullish(),
    helpText: z.string().max(500).nullish(),
    minLength: z.number().int().nonnegative().nullish(),
    maxLength: z.number().int().positive().nullish(),
    position: z.number().int().nonnegative().default(0),
    visibleInList: z.boolean().default(false),
    searchable: z.boolean().default(false),
    sortable: z.boolean().default(false),
    piiMasked: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.type === "select" || val.type === "multi_select") {
      const parsed = selectOptionsSchema.safeParse(val.options);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message:
            "options deve ser Array<{value,label}> não-vazio para select/multi_select",
        });
      }
    }
  });

export type CreateCustomAttributeInput = z.input<
  typeof createCustomAttributeSchema
>;

/**
 * Schema Zod para input de update (T8b). `type` e `key` são IMUTÁVEIS pós-criação
 * — mudá-los requereria rewrite de dados em todas as rows + drop/create index.
 * Spec v3 §3.8 + §4: apenas metadata (label, position, required, visibleInList,
 * isUnique toggle, etc.) pode ser alterada.
 */
export const updateCustomAttributeSchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    required: z.boolean().optional(),
    isUnique: z.boolean().optional(),
    options: z.unknown().optional(),
    defaultValue: z.unknown().optional(),
    placeholder: z.string().max(200).nullish(),
    helpText: z.string().max(500).nullish(),
    minLength: z.number().int().nonnegative().nullish(),
    maxLength: z.number().int().positive().nullish(),
    position: z.number().int().nonnegative().optional(),
    visibleInList: z.boolean().optional(),
    searchable: z.boolean().optional(),
    sortable: z.boolean().optional(),
    piiMasked: z.boolean().optional(),
  })
  .strict();

export type UpdateCustomAttributeInput = z.input<
  typeof updateCustomAttributeSchema
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof PermissionDeniedError) {
    return {
      success: false,
      error: `Sem permissão: ${err.message}`,
    };
  }
  if (err instanceof NoActiveCompanyError) {
    return { success: false, error: "Nenhuma empresa ativa encontrada" };
  }
  if (err instanceof CustomAttrCountExceededError) {
    return { success: false, error: err.message };
  }
  if (err instanceof CustomAttrReservedKeyError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, "custom-attributes.action.failed");
  return { success: false, error: fallback };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function listCustomAttributesAction(
  entity: CustomAttributeEntity,
): Promise<ActionResult<CustomAttribute[]>> {
  try {
    await requirePermission("custom-attributes:view");
    const companyId = await requireActiveCompanyId();
    const data = await listCustomAttributes(companyId, entity);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "Erro ao listar custom attributes");
  }
}

export async function getCustomAttribute(
  id: string,
): Promise<ActionResult<CustomAttribute>> {
  try {
    await requirePermission("custom-attributes:view");
    const companyId = await requireActiveCompanyId();
    const attr = await prisma.customAttribute.findFirst({
      where: { id, companyId },
    });
    if (!attr) {
      return { success: false, error: "Custom attribute não encontrado" };
    }
    return { success: true, data: attr as CustomAttribute };
  } catch (err) {
    return handleError(err, "Erro ao buscar custom attribute");
  }
}

export async function createCustomAttribute(
  input: CreateCustomAttributeInput,
): Promise<ActionResult<CustomAttribute>> {
  try {
    const user = await requirePermission("custom-attributes:manage");
    const companyId = await requireActiveCompanyId();

    const parsed = createCustomAttributeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }
    const data = parsed.data;

    assertKeyNotReserved(data.key);
    await assertAttrCount(companyId, data.entity);

    const created = await prisma.customAttribute.create({
      data: {
        companyId,
        entity: data.entity,
        key: data.key,
        label: data.label,
        type: data.type,
        required: data.required,
        isUnique: data.isUnique,
        options:
          data.options === undefined || data.options === null
            ? undefined
            : (data.options as object),
        defaultValue:
          data.defaultValue === undefined || data.defaultValue === null
            ? undefined
            : (data.defaultValue as object),
        placeholder: data.placeholder ?? null,
        helpText: data.helpText ?? null,
        minLength: data.minLength ?? null,
        maxLength: data.maxLength ?? null,
        position: data.position,
        visibleInList: data.visibleInList,
        searchable: data.searchable,
        sortable: data.sortable,
        piiMasked: data.piiMasked,
      },
    });

    revalidateTag(`custom-attrs:${companyId}:${data.entity}`, "max");

    await auditLog({
      actorType: ActorType.user,
      actorId: user.id,
      actorLabel: user.email ?? user.name ?? user.id,
      companyId,
      action: "created",
      resourceType: "custom_attribute",
      resourceId: created.id,
      details: { entity: data.entity, key: data.key },
      after: { added: [data.key] },
    });

    return { success: true, data: created as CustomAttribute };
  } catch (err) {
    return handleError(err, "Erro ao criar custom attribute");
  }
}

/**
 * Reordena custom attributes de uma entity no tenant ativo.
 *
 * Usa `prisma.$transaction` com `updateMany` por id — o `where` inclui
 * `companyId` + `entity`, evitando qualquer leak cross-tenant ou cross-entity
 * (ids de outro tenant simplesmente não afetam nenhuma row, count=0).
 *
 * Spec v3 §4: RBAC `custom-attributes:manage`, revalida tag do cache, auditLog.
 */
export async function reorderCustomAttributes(
  entity: CustomAttributeEntity,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    const user = await requirePermission("custom-attributes:manage");
    const companyId = await requireActiveCompanyId();

    if (!Array.isArray(orderedIds)) {
      return { success: false, error: "orderedIds must be array" };
    }
    if (orderedIds.length === 0) {
      return { success: true, data: undefined };
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.customAttribute.updateMany({
          where: { id, companyId, entity },
          data: { position: index },
        }),
      ),
    );

    revalidateTag(`custom-attrs:${companyId}:${entity}`, "max");

    await auditLog({
      actorType: ActorType.user,
      actorId: user.id,
      actorLabel: user.email ?? user.name ?? user.id,
      companyId,
      action: "reordered",
      resourceType: "custom_attribute",
      details: { entity, orderedIds },
    });

    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "Erro ao reordenar custom attributes");
  }
}

/**
 * Atualiza metadata de um custom attribute (T8b).
 *
 * Regras (spec v3 §3.8 + §4):
 * - `type` e `key` são IMUTÁVEIS — schema `.strict()` rejeita qualquer outra key.
 * - Toggle `isUnique false → true`: enqueue `create-unique-index` job (refcount++).
 * - Toggle `isUnique true → false`: enqueue `drop-unique-index` job.
 *     Trade-off MVP: o processor drop-index sempre enfileira finalize-delete-def
 *     no fim da chain, mas finalize-delete tem safety `status !== "deleting" → no-op`
 *     (ver custom-attr-finalize-delete.ts), então um job órfão é apenas ruído
 *     que não remove def ativa. Aceitável para o MVP.
 * - Revalida tag de cache e registra auditLog `updated`.
 */
export async function updateCustomAttribute(
  id: string,
  input: UpdateCustomAttributeInput & Record<string, unknown>,
): Promise<ActionResult<CustomAttribute>> {
  try {
    const user = await requirePermission("custom-attributes:manage");
    const companyId = await requireActiveCompanyId();

    // .strict() rejeita qualquer key não declarada — inclusive `type` e `key`.
    const parsed = updateCustomAttributeSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join(".") ?? "";
      // z.strict() emite code === "unrecognized_keys" quando há key extra.
      if (issue && issue.code === "unrecognized_keys") {
        const keys = (issue as unknown as { keys?: string[] }).keys ?? [];
        return {
          success: false,
          error: `Campo imutável: ${keys.join(", ")} não pode ser alterado após a criação`,
        };
      }
      return {
        success: false,
        error: issue?.message
          ? `${path ? path + ": " : ""}${issue.message}`
          : "Dados inválidos",
      };
    }
    const data = parsed.data;

    const existing = await prisma.customAttribute.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return { success: false, error: "Custom attribute não encontrado" };
    }

    const wasUnique = Boolean((existing as { isUnique?: boolean }).isUnique);
    const nextUnique =
      data.isUnique === undefined ? wasUnique : Boolean(data.isUnique);
    const toggleToTrue = !wasUnique && nextUnique;
    const toggleToFalse = wasUnique && !nextUnique;

    // Monta patch somente com campos definidos (undefined NÃO é sobrescrito no Prisma).
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      patch[k] = v;
    }

    const updated = await prisma.customAttribute.update({
      where: { id, companyId } as never,
      data: patch,
    });

    const entity = (existing as { entity: CustomAttributeEntity }).entity;
    const key = (existing as { key: string }).key;

    if (toggleToTrue) {
      await enqueueCreateIndex({ entity, key, defId: id });
    } else if (toggleToFalse) {
      await enqueueDropIndex({ entity, key, defId: id });
    }

    revalidateTag(`custom-attrs:${companyId}:${entity}`, "max");

    await auditLog({
      actorType: ActorType.user,
      actorId: user.id,
      actorLabel: user.email ?? user.name ?? user.id,
      companyId,
      action: "updated",
      resourceType: "custom_attribute",
      resourceId: id,
      details: { entity, key, fields: Object.keys(patch) },
    });

    return { success: true, data: updated as CustomAttribute };
  } catch (err) {
    return handleError(err, "Erro ao atualizar custom attribute");
  }
}

/**
 * Inicia delete assíncrono de um custom attribute (T8b, spec v3 §3.8 + CR-1).
 *
 * Fluxo:
 *   1. marca `status=deleting` (safety flag usada pelo finalize-delete worker).
 *   2. enqueue `purge-values` com `indexHandoff = def.isUnique`.
 *   3. revalida cache tag e audita `delete_initiated`.
 *   4. retorna jobId idempotente `purge:<entity>:<key>:<companyId>`.
 *
 * A finalização (delete físico da def) é feita pelo processor
 * `custom-attr-finalize-delete` ao final da chain purge → [drop-index] → finalize.
 */
export async function deleteCustomAttribute(
  id: string,
): Promise<ActionResult<{ jobId: string }>> {
  try {
    const user = await requirePermission("custom-attributes:manage");
    const companyId = await requireActiveCompanyId();

    const existing = await prisma.customAttribute.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return { success: false, error: "Custom attribute não encontrado" };
    }

    const status = (existing as { status?: string }).status;
    if (status === "deleting") {
      return {
        success: false,
        error: "Custom attribute já está sendo deletado",
      };
    }

    await prisma.customAttribute.update({
      where: { id, companyId } as never,
      data: { status: "deleting" },
    });

    const entity = (existing as { entity: CustomAttributeEntity }).entity;
    const key = (existing as { key: string }).key;
    const isUnique = Boolean((existing as { isUnique?: boolean }).isUnique);

    await enqueuePurgeValues({
      entity,
      key,
      companyId,
      defId: id,
      indexHandoff: isUnique,
    });

    revalidateTag(`custom-attrs:${companyId}:${entity}`, "max");

    await auditLog({
      actorType: ActorType.user,
      actorId: user.id,
      actorLabel: user.email ?? user.name ?? user.id,
      companyId,
      action: "delete_initiated",
      resourceType: "custom_attribute",
      resourceId: id,
      details: { entity, key, isUnique },
    });

    const jobId = `purge:${entity}:${key}:${companyId}`;
    return { success: true, data: { jobId } };
  } catch (err) {
    return handleError(err, "Erro ao deletar custom attribute");
  }
}
