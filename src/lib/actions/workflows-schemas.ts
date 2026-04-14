/**
 * Schemas Zod para workflows — exportados separadamente para permitir
 * importação em testes sem carregar dependências "use server" (next/cache, auth, etc.).
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Condition schema
// ---------------------------------------------------------------------------

export const conditionSchema = z.object({
  field: z.string().min(1, "Campo obrigatório").max(100, "Campo deve ter no máximo 100 caracteres"),
  op: z.enum(["eq", "neq", "in", "gt", "lt", "contains"], {
    errorMap: () => ({ message: "Operador inválido" }),
  }),
  value: z.unknown(),
});

// ---------------------------------------------------------------------------
// Action spec schema
// ---------------------------------------------------------------------------

export const actionSpecSchema = z.object({
  type: z.enum(["update-field", "create-task", "assign-user", "send-email"], {
    errorMap: () => ({ message: "Tipo de ação inválido" }),
  }),
  params: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const createWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, "Nome obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  description: z.string().max(1000, "Descrição deve ter no máximo 1000 caracteres").optional(),
  trigger: z.enum(["lead_created", "contact_created", "activity_completed"], {
    errorMap: () => ({ message: "Trigger inválido" }),
  }),
  conditions: z
    .array(conditionSchema)
    .max(20, "Máximo de 20 condições permitidas"),
  actions: z
    .array(actionSpecSchema)
    .max(10, "Máximo de 10 ações permitidas"),
  status: z.enum(["draft", "active", "paused"]).optional().default("draft"),
});

// ---------------------------------------------------------------------------
// Update schema
// ---------------------------------------------------------------------------

export const updateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, "Nome obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres")
    .optional(),
  description: z.string().max(1000).nullish(),
  trigger: z
    .enum(["lead_created", "contact_created", "activity_completed"])
    .optional(),
  conditions: z.array(conditionSchema).max(20).optional(),
  actions: z.array(actionSpecSchema).max(10).optional(),
});

// ---------------------------------------------------------------------------
// Status schema
// ---------------------------------------------------------------------------

export const setWorkflowStatusSchema = z.object({
  status: z.enum(["draft", "active", "paused"], {
    errorMap: () => ({ message: "Status inválido" }),
  }),
});

// Exportação dos schemas para uso em testes
export const _schemas = {
  createWorkflowSchema,
  updateWorkflowSchema,
  setWorkflowStatusSchema,
  conditionSchema,
  actionSpecSchema,
};
