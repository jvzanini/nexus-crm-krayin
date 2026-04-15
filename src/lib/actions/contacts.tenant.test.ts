/**
 * Frente 17 — Tenant scoping em contacts server actions.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      userCompanyMembership: { findFirst: vi.fn() },
      contact: {
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
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
import { getContacts, updateContact, deleteContact } from "./contacts";

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "user-1",
    platformRole: "admin",
    isSuperAdmin: false,
  });
  (prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    companyId: "company-A",
  });
});

describe("contacts tenant scoping", () => {
  it("getContacts filtra por companyId", async () => {
    (prisma.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getContacts();
    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-A" } }),
    );
  });

  it("updateContact cross-tenant retorna erro", async () => {
    const contactUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: any) => cb({ contact: { updateMany: contactUpdateMany, findFirst: vi.fn() } }),
    );
    const r = await updateContact("contact-x", { firstName: "X" });
    expect(r.success).toBe(false);
    expect(contactUpdateMany).toHaveBeenCalledWith({
      where: { id: "contact-x", companyId: "company-A" },
      data: { firstName: "X" },
    });
  });

  it("deleteContact cross-tenant retorna erro", async () => {
    (prisma.contact.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const r = await deleteContact("contact-other");
    expect(r.success).toBe(false);
    expect(prisma.contact.deleteMany).toHaveBeenCalledWith({
      where: { id: "contact-other", companyId: "company-A" },
    });
  });
});
