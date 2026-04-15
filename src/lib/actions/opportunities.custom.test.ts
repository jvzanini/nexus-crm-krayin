/**
 * Fase 5 — T17/34: custom attributes em opportunities (create/update/filter).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    customAttribute: { findMany: vi.fn() },
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  createOpportunity,
  updateOpportunity,
} from "./opportunities";

const defsFixture = [
  {
    id: "a1",
    companyId: "company-A",
    entity: "opportunity",
    key: "priority",
    label: "Priority",
    type: "text",
    required: false,
    unique: false,
    piiMasked: false,
    indexed: false,
    options: null,
    maxLength: 100,
    status: "active",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "a2",
    companyId: "company-A",
    entity: "opportunity",
    key: "source_code",
    label: "Source Code",
    type: "text",
    required: false,
    unique: true,
    piiMasked: false,
    indexed: true,
    options: null,
    maxLength: 50,
    status: "active",
    position: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "user-1",
    platformRole: "admin",
    isSuperAdmin: false,
  });
  (
    prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>
  ).mockResolvedValue({ companyId: "company-A" });
  (
    prisma.customAttribute.findMany as ReturnType<typeof vi.fn>
  ).mockResolvedValue(defsFixture);
});

describe("opportunities custom attributes (T17/34)", () => {
  it("createOpportunity persiste payload custom validado", async () => {
    (prisma.opportunity.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "op-1",
    });

    const r = await createOpportunity({
      title: "Nova",
      custom: { priority: "alto", source_code: "INB-42" },
    });

    expect(r.success).toBe(true);
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-A",
          title: "Nova",
          custom: { priority: "alto", source_code: "INB-42" },
        }),
      }),
    );
  });

  it("createOpportunity rejeita custom com chave desconhecida (strict)", async () => {
    const r = await createOpportunity({
      title: "X",
      custom: { unknown_key: "zzz" },
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/custom/i);
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("createOpportunity rejeita quando excede 32KB", async () => {
    (
      prisma.customAttribute.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      {
        ...defsFixture[0],
        key: "notes_long",
        maxLength: 100 * 1024,
      },
    ]);
    const huge = "x".repeat(40 * 1024);
    const r = await createOpportunity({
      title: "Big",
      custom: { notes_long: huge },
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/32|bytes|exced/i);
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("createOpportunity mapeia P2002 em erro amigável (unique custom)", async () => {
    const p2002 = Object.assign(new Error("unique"), {
      code: "P2002",
      meta: { target: "idx_opportunities_custom_source_code_unique" },
    });
    (prisma.opportunity.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      p2002,
    );

    const r = await createOpportunity({
      title: "Dup",
      custom: { source_code: "DUP-1" },
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/source_code|unique|já existe|duplicad/i);
  });

  it("updateOpportunity persiste custom parcial", async () => {
    (
      prisma.opportunity.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });

    const r = await updateOpportunity("op-1", {
      custom: { priority: "baixo" },
    });

    expect(r.success).toBe(true);
    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: { id: "op-1", companyId: "company-A" },
      data: expect.objectContaining({
        custom: { priority: "baixo" },
      }),
    });
  });

  it("updateOpportunity rejeita custom inválido (tipo errado)", async () => {
    const defsWithNumber = [
      {
        ...defsFixture[0],
        key: "score",
        type: "number",
      },
    ];
    (
      prisma.customAttribute.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue(defsWithNumber);

    const r = await updateOpportunity("op-1", {
      custom: { score: "not-a-number-at-all" },
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/custom/i);
    expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
  });
});
