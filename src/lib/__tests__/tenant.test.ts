import { describe, it, expect, beforeEach, vi } from "vitest";
import { configureCompanies } from "@nexusai360/multi-tenant";
import type { CompanyAdapter } from "@nexusai360/multi-tenant";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findMany: vi.fn() },
  },
}));

function makeFakeAdapter(memberships: any[] = []): CompanyAdapter {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listMembershipsByUser: vi.fn(async () => memberships),
    listMembershipsByCompany: vi.fn(),
    findMembership: vi.fn(),
    createMembership: vi.fn(),
    updateMembership: vi.fn(),
    deleteMembership: vi.fn(),
  } as any;
}

describe("tenant wrapper (delegação ao @nexusai360/multi-tenant)", () => {
  let mod: typeof import("../tenant");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mod = await import("../tenant");
  });

  it("getUserCompanyRole retorna role de membership ativa", async () => {
    configureCompanies(makeFakeAdapter([
      { id: "m1", userId: "u1", companyId: "c1", role: "manager",
        isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]));
    expect(await mod.getUserCompanyRole("u1", "c1")).toBe("manager");
  });

  it("getUserCompanyRole retorna null se membership inativa", async () => {
    configureCompanies(makeFakeAdapter([
      { id: "m1", userId: "u1", companyId: "c1", role: "manager",
        isActive: false, createdAt: new Date(), updatedAt: new Date() },
    ]));
    expect(await mod.getUserCompanyRole("u1", "c1")).toBeNull();
  });

  it("getUserCompanyRole retorna null se sem membership", async () => {
    configureCompanies(makeFakeAdapter([]));
    expect(await mod.getUserCompanyRole("u1", "c1")).toBeNull();
  });

  it("requireCompanyRole(viewer) passa para manager", async () => {
    configureCompanies(makeFakeAdapter([
      { id: "m1", userId: "u1", companyId: "c1", role: "manager",
        isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]));
    expect(await mod.requireCompanyRole("u1", "c1", "viewer")).toBe(true);
  });

  it("requireCompanyRole(company_admin) bloqueia manager", async () => {
    configureCompanies(makeFakeAdapter([
      { id: "m1", userId: "u1", companyId: "c1", role: "manager",
        isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]));
    expect(await mod.requireCompanyRole("u1", "c1", "company_admin")).toBe(false);
  });

  it("requireCompanyRole bloqueia se sem membership", async () => {
    configureCompanies(makeFakeAdapter([]));
    expect(await mod.requireCompanyRole("u1", "c1", "viewer")).toBe(false);
  });
});
