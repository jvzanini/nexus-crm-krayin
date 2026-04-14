import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// vi.mock é hoisted ao topo — NÃO referenciar variáveis externas na factory.
// Usamos vi.fn() inline e recuperamos as referências depois via import.
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => {
  const mockUpdateMany = vi.fn();
  const mockCreate = vi.fn();
  return {
    prisma: {
      lead: { updateMany: mockUpdateMany },
      contact: { updateMany: mockUpdateMany },
      opportunity: { updateMany: mockUpdateMany },
      activity: { create: mockCreate },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (após mocks)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { updateFieldExecutor } from "./update-field";
import { createTaskExecutor } from "./create-task";
import { assignUserExecutor } from "./assign-user";
import { sendEmailExecutor } from "./send-email";
import { runAction } from "./index";
import type { ActionContext } from "./types";

// Referências para os fns mockados
const mockUpdateMany = prisma.lead.updateMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.activity.create as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCtx = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  companyId: "company-1",
  eventId: "evt-1",
  payload: { id: "entity-1", email: "test@example.com" },
  chainDepth: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// updateFieldExecutor
// ---------------------------------------------------------------------------

describe("updateFieldExecutor", () => {
  it("id resolvido → updateMany chamado com data correta (lead)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await updateFieldExecutor(
      { entityType: "lead", idField: "id", field: "status", value: "qualified" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({ updated: 1, id: "entity-1", field: "status" });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "entity-1", companyId: "company-1" },
      data: { status: "qualified" },
    });
  });

  it("id resolvido → updateMany chamado com data correta (opportunity)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await updateFieldExecutor(
      { entityType: "opportunity", idField: "id", field: "stage", value: "proposal" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "entity-1", companyId: "company-1" },
      data: { stage: "proposal" },
    });
  });

  it("id resolvido → updateMany chamado com data correta (contact)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await updateFieldExecutor(
      { entityType: "contact", idField: "id", field: "notes", value: "updated note" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "entity-1", companyId: "company-1" },
      data: { notes: "updated note" },
    });
  });

  it("id não resolvido → retorna error", async () => {
    const result = await updateFieldExecutor(
      { entityType: "lead", idField: "nonexistent.path", field: "status", value: "qualified" },
      makeCtx({ payload: {} }),
    );

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("nonexistent.path");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("updateMany retorna count 0 → entity não encontrada", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await updateFieldExecutor(
      { entityType: "lead", idField: "id", field: "status", value: "qualified" },
      makeCtx(),
    );

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("não encontrada");
  });

  it("path aninhado é resolvido corretamente", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await updateFieldExecutor(
      { entityType: "lead", idField: "lead.id", field: "status", value: "contacted" },
      makeCtx({ payload: { lead: { id: "nested-id" } } }),
    );

    expect(result.ok).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "nested-id", companyId: "company-1" },
      data: { status: "contacted" },
    });
  });

  it("prisma lança exceção → retorna ok false com error", async () => {
    mockUpdateMany.mockRejectedValueOnce(new Error("DB connection failed"));

    const result = await updateFieldExecutor(
      { entityType: "lead", idField: "id", field: "status", value: "qualified" },
      makeCtx(),
    );

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("DB connection failed");
  });
});

// ---------------------------------------------------------------------------
// createTaskExecutor
// ---------------------------------------------------------------------------

describe("createTaskExecutor", () => {
  it("dueInHours=24 → dueAt ~24h no futuro (±5s tolerance)", async () => {
    const beforeCall = Date.now();
    const fakeActivity = { id: "activity-uuid" };
    mockCreate.mockResolvedValueOnce(fakeActivity);

    const result = await createTaskExecutor(
      { title: "Follow up", dueInHours: 24 },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(result.output.activityId).toBe("activity-uuid");

    const callArgs = mockCreate.mock.calls[0][0];
    const dueAt: Date = callArgs.data.dueAt;
    expect(dueAt).toBeInstanceOf(Date);
    const diff = dueAt.getTime() - beforeCall;
    const expected = 24 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThanOrEqual(expected - 5000);
    expect(diff).toBeLessThanOrEqual(expected + 5000);
  });

  it("sem dueInHours → dueAt é null", async () => {
    mockCreate.mockResolvedValueOnce({ id: "activity-uuid-2" });

    await createTaskExecutor({ title: "Review" }, makeCtx());

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.data.dueAt).toBeNull();
  });

  it("subjectIdField customizado é resolvido do payload", async () => {
    mockCreate.mockResolvedValueOnce({ id: "act-3" });

    await createTaskExecutor(
      { title: "Task", subjectIdField: "lead.id", subjectType: "lead" },
      makeCtx({ payload: { lead: { id: "lead-123" } } }),
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.data.subjectId).toBe("lead-123");
    expect(callArgs.data.subjectType).toBe("lead");
  });

  it("subject não resolvido → retorna error", async () => {
    const result = await createTaskExecutor(
      { title: "Task", subjectIdField: "nonexistent" },
      makeCtx({ payload: {} }),
    );

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("subject não resolvido");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("assignedTo preenchido → createdBy e assignedTo definidos no create", async () => {
    mockCreate.mockResolvedValueOnce({ id: "act-4" });

    await createTaskExecutor(
      { title: "Assigned Task", assignedTo: "user-456" },
      makeCtx(),
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.data.assignedTo).toBe("user-456");
    expect(callArgs.data.createdBy).toBe("user-456");
  });

  it("sem assignedTo → createdBy usa SYSTEM_USER_ID", async () => {
    mockCreate.mockResolvedValueOnce({ id: "act-5" });

    await createTaskExecutor({ title: "System Task" }, makeCtx());

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.data.assignedTo).toBeNull();
    expect(callArgs.data.createdBy).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("prisma lança exceção → retorna ok false", async () => {
    mockCreate.mockRejectedValueOnce(new Error("FK violation"));

    const result = await createTaskExecutor({ title: "Bad Task" }, makeCtx());

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("FK violation");
  });

  it("subjectType padrão é lead quando não informado", async () => {
    mockCreate.mockResolvedValueOnce({ id: "act-6" });

    await createTaskExecutor({ title: "Default subject" }, makeCtx());

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.data.subjectType).toBe("lead");
  });
});

// ---------------------------------------------------------------------------
// assignUserExecutor
// ---------------------------------------------------------------------------

describe("assignUserExecutor", () => {
  it("contact retorna skipped com razão clara", async () => {
    const result = await assignUserExecutor(
      { entityType: "contact", idField: "id", userId: "user-1" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("assignedTo");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("lead chama updateMany com assignedTo correto", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await assignUserExecutor(
      { entityType: "lead", idField: "id", userId: "user-99" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({ updated: 1 });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "entity-1", companyId: "company-1" },
      data: { assignedTo: "user-99" },
    });
  });

  it("opportunity chama updateMany com assignedTo correto", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await assignUserExecutor(
      { entityType: "opportunity", idField: "id", userId: "user-42" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "entity-1", companyId: "company-1" },
      data: { assignedTo: "user-42" },
    });
  });

  it("id não resolvido → retorna error", async () => {
    const result = await assignUserExecutor(
      { entityType: "lead", idField: "missing", userId: "user-1" },
      makeCtx({ payload: {} }),
    );

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("missing");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("updateMany count 0 → entity não encontrada", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await assignUserExecutor(
      { entityType: "lead", idField: "id", userId: "user-1" },
      makeCtx(),
    );

    expect(result.ok).toBe(false);
    expect(result.output.error).toContain("não encontrada");
  });
});

// ---------------------------------------------------------------------------
// sendEmailExecutor
// ---------------------------------------------------------------------------

describe("sendEmailExecutor", () => {
  it("sempre retorna skipped=true", async () => {
    const result = await sendEmailExecutor(
      { mailboxId: "mb-1", subject: "Hello", bodyHtml: "<p>Hi</p>", toField: "email" },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("skipReason menciona Fase 7c", async () => {
    const result = await sendEmailExecutor(
      { mailboxId: "mb-1", subject: "Hello", bodyHtml: "<p>Hi</p>", toField: "email" },
      makeCtx(),
    );

    expect(result.skipReason).toContain("Fase 7c");
  });

  it("output é objeto vazio", async () => {
    const result = await sendEmailExecutor(
      { mailboxId: "mb-1", subject: "Hello", bodyHtml: "<p>Hi</p>", toField: "email" },
      makeCtx(),
    );

    expect(result.output).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// runAction — dispatch por type
// ---------------------------------------------------------------------------

describe("runAction", () => {
  it("dispatcha update-field corretamente", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await runAction(
      { type: "update-field", params: { entityType: "lead", idField: "id", field: "status", value: "new" } },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalled();
  });

  it("dispatcha create-task corretamente", async () => {
    mockCreate.mockResolvedValueOnce({ id: "act-dispatch" });

    const result = await runAction(
      { type: "create-task", params: { title: "Dispatch Test" } },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("dispatcha assign-user corretamente (lead)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await runAction(
      { type: "assign-user", params: { entityType: "lead", idField: "id", userId: "u-1" } },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
  });

  it("dispatcha send-email → skipped", async () => {
    const result = await runAction(
      { type: "send-email", params: { mailboxId: "mb", subject: "s", bodyHtml: "<p>b</p>", toField: "email" } },
      makeCtx(),
    );

    expect(result.skipped).toBe(true);
  });
});
