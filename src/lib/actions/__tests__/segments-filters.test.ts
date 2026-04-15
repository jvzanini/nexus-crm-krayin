import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks — devem ser declarados antes do import dinâmico da ação.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    segment: {
      findMany: vi.fn(),
    },
    userCompanyMembership: {
      findFirst: vi.fn(async () => ({ companyId: "company-1" })),
    },
  },
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({ id: "user-1" })),
  PermissionDeniedError: class PermissionDeniedError extends Error {},
}));

vi.mock("@/lib/marketing/segment", () => ({
  buildWhereFromFilters: vi.fn(() => ({ AND: [] })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe("listSegmentsAction — filtros URL (Fase 32 Grupo D)", () => {
  let listSegmentsAction: typeof import("../marketing-segments").listSegmentsAction;
  let prismaMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../marketing-segments");
    listSegmentsAction = mod.listSegmentsAction;
    prismaMock = (await import("@/lib/prisma")).prisma;
    prismaMock.segment.findMany.mockResolvedValue([]);
  });

  it("aplica filtro q (name contains insensitive) + companyId", async () => {
    const res = await listSegmentsAction({ q: "vip" });
    expect(res.success).toBe(true);
    const call = prismaMock.segment.findMany.mock.calls[0][0];
    expect(call.where.companyId).toBe("company-1");
    expect(call.where.name).toEqual({ contains: "vip", mode: "insensitive" });
  });

  it("aplica range from + to em createdAt preservando companyId", async () => {
    const res = await listSegmentsAction({
      from: "2026-01-01",
      to: "2026-02-01",
    });
    expect(res.success).toBe(true);
    const call = prismaMock.segment.findMany.mock.calls[0][0];
    expect(call.where.companyId).toBe("company-1");
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    expect(call.where.createdAt.gte.toISOString().startsWith("2026-01-01")).toBe(true);
    // lte ajustado para fim do dia
    expect(call.where.createdAt.lte.toISOString().startsWith("2026-02-01")).toBe(true);
  });

  it("sem filtros: where contém apenas companyId", async () => {
    const res = await listSegmentsAction();
    expect(res.success).toBe(true);
    const call = prismaMock.segment.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ companyId: "company-1" });
  });

  it("ignora filtros inválidos via safeParse (ex: q vazio) e não quebra", async () => {
    const res = await listSegmentsAction({ q: "" });
    expect(res.success).toBe(true);
    const call = prismaMock.segment.findMany.mock.calls[0][0];
    expect(call.where.companyId).toBe("company-1");
    expect(call.where.name).toBeUndefined();
  });
});
