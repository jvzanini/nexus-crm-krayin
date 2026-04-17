import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "./dispatcher";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueueAdd = vi.fn(async () => ({ id: "job-1" }));

vi.mock("@/lib/worker/queues/automation-execute", () => ({
  AUTOMATION_EXECUTE_QUEUE: "automation-execute",
  automationQueue: { add: (...args: any[]) => mockQueueAdd(...args) },
}));

const mockWorkflowFindMany = vi.fn(async () => []);
const mockExecutionUpsert = vi.fn(async (opts: any) => ({
  id: "exec-uuid-1",
  workflowId: opts.create?.workflowId ?? "wf-1",
  eventId: opts.create?.eventId ?? "ev-1",
  status: opts.create?.status ?? "pending",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflow: {
      findMany: (...args: any[]) => mockWorkflowFindMany(...args),
    },
    workflowExecution: {
      upsert: (...args: any[]) => mockExecutionUpsert(...args),
    },
  },
}));

// redis mock para guards.incrementQuotaOrReject
vi.mock("@/lib/redis", () => ({
  redis: {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    set: vi.fn(async () => "OK"),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflowFindMany.mockResolvedValue([]);
  });

  it("sem workflows ativos: retorna {dispatched:0, aborted:0}", async () => {
    const result = await dispatch("lead_created", {
      companyId: "co-1",
      payload: { status: "new" },
    });
    expect(result).toEqual({ dispatched: 0, aborted: 0 });
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("chainDepth >= 10 → aborted_chain_depth, retorna {dispatched:0, aborted:1}", async () => {
    const result = await dispatch("lead_created", {
      companyId: "co-1",
      payload: {},
      chainDepth: 10,
    });
    expect(result).toEqual({ dispatched: 0, aborted: 1 });
    expect(mockWorkflowFindMany).not.toHaveBeenCalled();
  });

  it("workflow ativo + conditions passa → enqueue + execution created", async () => {
    mockWorkflowFindMany.mockResolvedValueOnce([
      {
        id: "wf-1",
        companyId: "co-1",
        status: "active",
        trigger: "lead_created",
        conditions: [], // sem conditions → sempre passa
        actions: [],
      },
    ]);

    const result = await dispatch("lead_created", {
      companyId: "co-1",
      payload: { status: "new" },
      eventId: "ev-fixed",
    });

    expect(result.dispatched).toBe(1);
    expect(result.aborted).toBe(0);
    expect(mockExecutionUpsert).toHaveBeenCalledOnce();
    expect(mockQueueAdd).toHaveBeenCalledOnce();
    // jobId deve ter prefixo exec-
    const callArgs = mockQueueAdd.mock.calls[0];
    expect(callArgs[2].jobId).toMatch(/^exec-/);
  });

  it("condition não passa → workflow ignorado, nada enfileirado", async () => {
    mockWorkflowFindMany.mockResolvedValueOnce([
      {
        id: "wf-2",
        companyId: "co-1",
        status: "active",
        trigger: "lead_created",
        conditions: [{ field: "status", op: "eq", value: "qualified" }],
        actions: [],
      },
    ]);

    const result = await dispatch("lead_created", {
      companyId: "co-1",
      payload: { status: "new" }, // não satisfaz "qualified"
    });

    expect(result.dispatched).toBe(0);
    expect(result.aborted).toBe(0);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("idempotency: mesmo eventId chamado 2x → upsert chamado mas cria só 1 execution", async () => {
    const activeWf = {
      id: "wf-3",
      companyId: "co-2",
      status: "active",
      trigger: "lead_created",
      conditions: [],
      actions: [],
    };
    mockWorkflowFindMany.mockResolvedValue([activeWf]);
    // Simula: segunda chamada retorna execution existente (update:{} não cria novo)
    const existingExec = { id: "exec-existing", workflowId: "wf-3", eventId: "ev-idempotent", status: "pending" };
    mockExecutionUpsert.mockResolvedValueOnce(existingExec).mockResolvedValueOnce(existingExec);

    await dispatch("lead_created", { companyId: "co-2", payload: {}, eventId: "ev-idempotent" });
    await dispatch("lead_created", { companyId: "co-2", payload: {}, eventId: "ev-idempotent" });

    // upsert chamado 2x (uma por dispatch), mas ambas usam where uq_execution_workflow_event
    expect(mockExecutionUpsert).toHaveBeenCalledTimes(2);
    // Ambos os upserts usam o mesmo eventId
    const call1 = mockExecutionUpsert.mock.calls[0][0];
    const call2 = mockExecutionUpsert.mock.calls[1][0];
    expect(call1.where.uq_execution_workflow_event.eventId).toBe("ev-idempotent");
    expect(call2.where.uq_execution_workflow_event.eventId).toBe("ev-idempotent");
    // update:{} garante que não sobrescreve
    expect(call1.update).toEqual({});
    expect(call2.update).toEqual({});
  });
});
