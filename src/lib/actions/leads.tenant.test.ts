/**
 * Frente 17 — Tenant scoping em leads server actions.
 * Valida que toda query filtra por companyId do membership ativo.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      userCompanyMembership: { findFirst: vi.fn() },
      lead: {
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb({
        lead: {
          create: (vi as any).__leadCreate ?? vi.fn(),
          updateMany: (vi as any).__leadUpdateMany ?? vi.fn(),
          findFirst: (vi as any).__leadFindFirst ?? vi.fn(),
        },
      })),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map<string, string>()),
}));
vi.mock("@/lib/consent", () => ({
  recordConsent: vi.fn(),
  maskIp: () => "127.0.0.0/24",
}));
vi.mock("@/lib/automation/dispatcher", () => ({
  dispatch: vi.fn(async () => undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getLeads, updateLead, deleteLead } from "./leads";

const mockUser = {
  id: "user-1",
  email: "u@x.com",
  name: "User",
  isSuperAdmin: false,
} as any;

const getMemFindFirst = () =>
  prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  getMemFindFirst().mockResolvedValue({ companyId: "company-A" });
});

describe("leads tenant scoping", () => {
  it("getLeads filtra por companyId do tenant ativo", async () => {
    (prisma.lead.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getLeads();
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-A" } }),
    );
  });

  it("updateLead usa updateMany com companyId (impede cross-tenant)", async () => {
    const leadUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: any) =>
        cb({
          lead: { updateMany: leadUpdateMany, findFirst: vi.fn() },
        }),
    );

    const r = await updateLead("lead-1", { name: "novo" });
    expect(r.success).toBe(true);
    expect(leadUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1", companyId: "company-A" },
        data: expect.objectContaining({ name: "novo" }),
      }),
    );
  });

  it("updateLead retorna erro quando lead pertence a outro tenant (count=0)", async () => {
    const leadUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: any) =>
        cb({
          lead: { updateMany: leadUpdateMany, findFirst: vi.fn() },
        }),
    );
    const r = await updateLead("lead-other-tenant", { name: "x" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/não encontrado/i);
  });

  it("deleteLead usa deleteMany com companyId", async () => {
    (prisma.lead.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    const r = await deleteLead("lead-1");
    expect(r.success).toBe(true);
    expect(prisma.lead.deleteMany).toHaveBeenCalledWith({
      where: { id: "lead-1", companyId: "company-A" },
    });
  });

  it("deleteLead retorna erro se lead é de outro tenant (count=0)", async () => {
    (prisma.lead.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const r = await deleteLead("lead-x");
    expect(r.success).toBe(false);
  });

  it("sem membership ativa → erro Empresa ativa não encontrada", async () => {
    getMemFindFirst().mockResolvedValue(null);
    const r = await getLeads();
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Empresa/);
  });
});
