/**
 * Frente 17 — Tenant scoping em opportunities server actions.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    opportunity: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  getOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from "./opportunities";

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "user-1",
    isSuperAdmin: false,
  });
  (prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    companyId: "company-A",
  });
});

describe("opportunities tenant scoping", () => {
  it("getOpportunities filtra por companyId", async () => {
    (prisma.opportunity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getOpportunities();
    expect(prisma.opportunity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-A" } }),
    );
  });

  it("createOpportunity grava companyId do tenant ativo", async () => {
    (prisma.opportunity.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "op-1" });
    const r = await createOpportunity({ title: "Nova" });
    expect(r.success).toBe(true);
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "company-A", title: "Nova" }),
      }),
    );
  });

  it("createOpportunity rejeita contactId de outro tenant", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await createOpportunity({ title: "X", contactId: "contact-cross-tenant" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Contato/);
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("updateOpportunity cross-tenant retorna erro", async () => {
    (prisma.opportunity.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const r = await updateOpportunity("op-x", { title: "y" });
    expect(r.success).toBe(false);
    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: { id: "op-x", companyId: "company-A" },
      data: { title: "y" },
    });
  });

  it("deleteOpportunity cross-tenant retorna erro", async () => {
    (prisma.opportunity.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const r = await deleteOpportunity("op-other");
    expect(r.success).toBe(false);
    expect(prisma.opportunity.deleteMany).toHaveBeenCalledWith({
      where: { id: "op-other", companyId: "company-A" },
    });
  });
});
