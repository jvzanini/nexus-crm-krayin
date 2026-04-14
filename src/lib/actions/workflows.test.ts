/**
 * Testes de validação pura dos schemas de workflows.
 * Não testam integração com DB — apenas regras Zod.
 */
import { describe, expect, it } from "vitest";
import { _schemas } from "./workflows-schemas";

const { createWorkflowSchema, conditionSchema, actionSpecSchema } = _schemas;

// ---------------------------------------------------------------------------
// name
// ---------------------------------------------------------------------------

describe("name — validação", () => {
  it("rejeita name vazio", () => {
    const result = createWorkflowSchema.safeParse({
      name: "",
      trigger: "lead_created",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name com mais de 200 caracteres", () => {
    const result = createWorkflowSchema.safeParse({
      name: "A".repeat(201),
      trigger: "lead_created",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("aceita name com exatamente 200 caracteres", () => {
    const result = createWorkflowSchema.safeParse({
      name: "A".repeat(200),
      trigger: "lead_created",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita name válido", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Workflow de leads",
      trigger: "lead_created",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// trigger
// ---------------------------------------------------------------------------

describe("trigger — validação", () => {
  it("rejeita trigger inválido", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "invalid_trigger",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("aceita lead_created", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "lead_created",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita contact_created", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "contact_created",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita activity_completed", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "activity_completed",
      conditions: [],
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// conditions
// ---------------------------------------------------------------------------

describe("conditions — validação", () => {
  it("rejeita condition com op fora do enum", () => {
    const result = conditionSchema.safeParse({
      field: "status",
      op: "invalid_op",
      value: "test",
    });
    expect(result.success).toBe(false);
  });

  it("aceita condition com op eq", () => {
    const result = conditionSchema.safeParse({
      field: "status",
      op: "eq",
      value: "new",
    });
    expect(result.success).toBe(true);
  });

  it("aceita todos os ops válidos", () => {
    const validOps = ["eq", "neq", "in", "gt", "lt", "contains"] as const;
    for (const op of validOps) {
      const result = conditionSchema.safeParse({ field: "status", op, value: "test" });
      expect(result.success).toBe(true);
    }
  });

  it("rejeita condition com field vazio", () => {
    const result = conditionSchema.safeParse({
      field: "",
      op: "eq",
      value: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita 21 conditions (max 20)", () => {
    const conditions = Array.from({ length: 21 }, (_, i) => ({
      field: `field_${i}`,
      op: "eq",
      value: "test",
    }));
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "lead_created",
      conditions,
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("aceita exatamente 20 conditions", () => {
    const conditions = Array.from({ length: 20 }, (_, i) => ({
      field: `field_${i}`,
      op: "eq",
      value: "test",
    }));
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "lead_created",
      conditions,
      actions: [{ type: "update-field", params: {} }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

describe("actions — validação", () => {
  it("rejeita action type inválido", () => {
    const result = actionSpecSchema.safeParse({
      type: "invalid-type",
      params: {},
    });
    expect(result.success).toBe(false);
  });

  it("aceita update-field", () => {
    const result = actionSpecSchema.safeParse({ type: "update-field", params: {} });
    expect(result.success).toBe(true);
  });

  it("aceita create-task", () => {
    const result = actionSpecSchema.safeParse({ type: "create-task", params: {} });
    expect(result.success).toBe(true);
  });

  it("aceita assign-user", () => {
    const result = actionSpecSchema.safeParse({ type: "assign-user", params: {} });
    expect(result.success).toBe(true);
  });

  it("aceita send-email", () => {
    const result = actionSpecSchema.safeParse({ type: "send-email", params: {} });
    expect(result.success).toBe(true);
  });

  it("rejeita 11 actions (max 10)", () => {
    const actions = Array.from({ length: 11 }, () => ({
      type: "update-field",
      params: {},
    }));
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "lead_created",
      conditions: [],
      actions,
    });
    expect(result.success).toBe(false);
  });

  it("aceita exatamente 10 actions", () => {
    const actions = Array.from({ length: 10 }, () => ({
      type: "update-field",
      params: {},
    }));
    const result = createWorkflowSchema.safeParse({
      name: "Teste",
      trigger: "lead_created",
      conditions: [],
      actions,
    });
    expect(result.success).toBe(true);
  });
});
