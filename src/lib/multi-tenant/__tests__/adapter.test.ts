import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CompanyAdapter } from "@nexusai360/multi-tenant";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userCompanyMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaCompanyAdapter } from "../adapter";

describe("PrismaCompanyAdapter", () => {
  let adapter: CompanyAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PrismaCompanyAdapter();
  });

  it("findById mapeia campos do contract sem vazar locale/timezone/currency", async () => {
    (prisma.company.findUnique as any).mockResolvedValue({
      id: "c1", name: "Acme", slug: "acme", logoUrl: null, features: { x: true },
      isActive: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      locale: "pt-BR", defaultTimezone: "America/Sao_Paulo", baseCurrency: "BRL",
      localeChangedAt: new Date(), localeChangedBy: "u1",
    });
    const c = await adapter.findById("c1");
    expect(c).toEqual({
      id: "c1", name: "Acme", slug: "acme", logoUrl: null, features: { x: true },
      isActive: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
    });
    expect((c as any).locale).toBeUndefined();
  });

  it("findById retorna null se prisma retorna null", async () => {
    (prisma.company.findUnique as any).mockResolvedValue(null);
    expect(await adapter.findById("missing")).toBeNull();
  });

  it("listMembershipsByUser mapeia role corretamente", async () => {
    (prisma.userCompanyMembership.findMany as any).mockResolvedValue([
      { id: "m1", userId: "u1", companyId: "c1", role: "company_admin",
        isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const list = await adapter.listMembershipsByUser("u1");
    expect(list).toHaveLength(1);
    expect(list[0].role).toBe("company_admin");
    expect(prisma.userCompanyMembership.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("findMembership compõe where userId+companyId", async () => {
    (prisma.userCompanyMembership.findUnique as any).mockResolvedValue(null);
    await adapter.findMembership("u1", "c1");
    expect(prisma.userCompanyMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_companyId: { userId: "u1", companyId: "c1" } },
    });
  });
});
