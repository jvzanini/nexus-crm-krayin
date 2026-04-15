/**
 * Fase 32 — Grupo C: filtros URL em listCampaignsAction.
 * Valida que o where passado ao prisma.campaign.findMany reflete
 * os filtros vindos da URL (status, q, from/to).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findFirst: vi.fn() },
    campaign: { findMany: vi.fn() },
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

vi.mock("@/lib/marketing/segment", () => ({
  buildWhereFromFilters: vi.fn(() => ({ AND: [] })),
}));

vi.mock("@/lib/worker/queues/marketing-send", () => ({
  enqueueMarketingSend: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { listCampaignsAction } from "../marketing-campaigns";

const findManyMock = prisma.campaign.findMany as ReturnType<typeof vi.fn>;
const membershipMock = prisma.userCompanyMembership
  .findFirst as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  membershipMock.mockResolvedValue({ companyId: "company-A" });
  findManyMock.mockResolvedValue([]);
});

describe("listCampaignsAction filtros URL (Fase 32)", () => {
  it("aplica filtro de status enum", async () => {
    await listCampaignsAction({ status: "draft" });
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.status).toBe("draft");
  });

  it("aplica busca q com contains/insensitive em name", async () => {
    await listCampaignsAction({ q: "Promo" });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.name).toEqual({
      contains: "Promo",
      mode: "insensitive",
    });
  });

  it("aplica range de datas from+to em createdAt (inclui 23:59:59.999Z do dia to)", async () => {
    await listCampaignsAction({
      from: "2026-04-01",
      to: "2026-04-15",
    });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    const range = arg.where.createdAt as { gte: Date; lte: Date };
    expect(range.gte).toBeInstanceOf(Date);
    expect(range.lte).toBeInstanceOf(Date);
    expect(range.gte.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2026-04-15T23:59:59.999Z");
  });

  it("ignora status inválido (safeParse falha → sem filtro de status)", async () => {
    await listCampaignsAction({ status: "invalid-status" });
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.companyId).toBe("company-A");
    expect(arg.where.status).toBeUndefined();
  });

  it("sem filtros retorna apenas companyId no where", async () => {
    await listCampaignsAction();
    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where).toEqual({ companyId: "company-A" });
  });
});
