/**
 * Fase 32 — Grupo E: filtros URL em listWorkflowsAction.
 * Valida que o where passado ao prisma.workflow.findMany reflete
 * os filtros vindos da URL (status, trigger, q).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findFirst: vi.fn() },
    workflow: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/rbac", async () => {
  class PermissionDeniedError extends Error {}
  return {
    requirePermission: vi.fn(async () => ({
      id: "user-1",
      email: "u@x.com",
      name: "User",
    })),
    PermissionDeniedError,
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { listWorkflowsAction } from "../workflows";

const findManyMock = prisma.workflow.findMany as ReturnType<typeof vi.fn>;
const membershipMock = prisma.userCompanyMembership
  .findFirst as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  membershipMock.mockResolvedValue({ companyId: "company-A" });
  findManyMock.mockResolvedValue([]);
});

describe("listWorkflowsAction filtros URL (Fase 32 Grupo E)", () => {
  it("aplica filtro de status enum", async () => {
    await listWorkflowsAction({ status: "active" });
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.status).toBe("active");
  });

  it("aplica filtro de trigger enum", async () => {
    await listWorkflowsAction({ trigger: "lead_created" });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.trigger).toBe("lead_created");
  });

  it("aplica busca q com contains/insensitive em name", async () => {
    await listWorkflowsAction({ q: "onboarding" });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.name).toEqual({
      contains: "onboarding",
      mode: "insensitive",
    });
  });

  it("combina status + trigger + q", async () => {
    await listWorkflowsAction({
      status: "paused",
      trigger: "contact_created",
      q: "lead",
    });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.status).toBe("paused");
    expect(arg.where.trigger).toBe("contact_created");
    expect(arg.where.name).toEqual({ contains: "lead", mode: "insensitive" });
  });

  it("ignora status inválido (safeParse falha → sem filtro de status)", async () => {
    await listWorkflowsAction({ status: "invalid-status" });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.status).toBeUndefined();
  });

  it("ignora trigger inválido", async () => {
    await listWorkflowsAction({ trigger: "invalid_trigger" });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.trigger).toBeUndefined();
  });

  it("sem filtros retorna apenas companyId no where", async () => {
    await listWorkflowsAction();
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where).toEqual({ companyId: "company-A" });
  });

  it("retorna erro quando não há empresa ativa", async () => {
    membershipMock.mockResolvedValue(null);
    const result = await listWorkflowsAction({ status: "active" });
    expect(result.success).toBe(false);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
