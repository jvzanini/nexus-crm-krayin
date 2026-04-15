/**
 * Fase 5 — Custom Attributes: server actions list/get/create (T8a/34).
 * Spec v3 §4 — RBAC matrix, caps, reserved keys, options shape, revalidateTag.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customAttribute: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rbac", () => {
  class PermissionDeniedError extends Error {
    constructor(permission: string) {
      super(`Permission denied: ${permission}`);
      this.name = "PermissionDeniedError";
    }
  }
  return {
    requirePermission: vi.fn(),
    PermissionDeniedError,
  };
});

vi.mock("@/lib/tenant-scope", () => ({
  requireActiveCompanyId: vi.fn(),
  NoActiveCompanyError: class NoActiveCompanyError extends Error {
    constructor() {
      super("no_active_company");
      this.name = "NoActiveCompanyError";
    }
  },
}));

vi.mock("@/lib/custom-attributes/list", () => ({
  listCustomAttributes: vi.fn(),
  invalidateCustomAttrsCache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  auditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import { revalidateTag } from "next/cache";
import { auditLog } from "@/lib/audit-log";

import {
  listCustomAttributesAction,
  getCustomAttribute,
  createCustomAttribute,
} from "./custom-attributes";

type Mock = ReturnType<typeof vi.fn>;

const mockUser = {
  id: "user-1",
  email: "admin@test.com",
  name: "Admin",
  platformRole: "admin",
  isSuperAdmin: false,
} as const;

const mockSuperAdmin = {
  id: "user-super",
  email: "super@test.com",
  name: "Super",
  platformRole: "super_admin",
  isSuperAdmin: true,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  (requirePermission as Mock).mockResolvedValue(mockUser);
  (requireActiveCompanyId as Mock).mockResolvedValue("company-A");
});

// ---------------------------------------------------------------------------
// listCustomAttributesAction
// ---------------------------------------------------------------------------

describe("listCustomAttributesAction", () => {
  it("happy path — retorna lista filtrada por tenant+entity", async () => {
    (listCustomAttributes as Mock).mockResolvedValue([
      { id: "a1", key: "cpf", entity: "lead" },
    ]);

    const res = await listCustomAttributesAction("lead");

    expect(res.success).toBe(true);
    expect(res.data).toEqual([{ id: "a1", key: "cpf", entity: "lead" }]);
    expect(requirePermission).toHaveBeenCalledWith("custom-attributes:view");
    expect(listCustomAttributes).toHaveBeenCalledWith("company-A", "lead");
  });

  it("sem permissão retorna 403 (success=false)", async () => {
    (requirePermission as Mock).mockRejectedValue(
      new PermissionDeniedError("custom-attributes:view"),
    );

    const res = await listCustomAttributesAction("lead");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/permiss/i);
    expect(listCustomAttributes).not.toHaveBeenCalled();
  });

  it("super_admin também consulta pelo companyId ativo (sem bypass implícito)", async () => {
    (requirePermission as Mock).mockResolvedValue(mockSuperAdmin);
    (requireActiveCompanyId as Mock).mockResolvedValue("company-B");
    (listCustomAttributes as Mock).mockResolvedValue([{ id: "s1" }]);

    const res = await listCustomAttributesAction("contact");

    expect(res.success).toBe(true);
    expect(listCustomAttributes).toHaveBeenCalledWith("company-B", "contact");
  });
});

// ---------------------------------------------------------------------------
// getCustomAttribute
// ---------------------------------------------------------------------------

describe("getCustomAttribute", () => {
  it("happy path — encontra attr do tenant", async () => {
    (prisma.customAttribute.findFirst as Mock).mockResolvedValue({
      id: "a1",
      companyId: "company-A",
      key: "cpf",
    });

    const res = await getCustomAttribute("a1");

    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      id: "a1",
      companyId: "company-A",
      key: "cpf",
    });
    expect(prisma.customAttribute.findFirst).toHaveBeenCalledWith({
      where: { id: "a1", companyId: "company-A" },
    });
  });

  it("not found retorna erro", async () => {
    (prisma.customAttribute.findFirst as Mock).mockResolvedValue(null);

    const res = await getCustomAttribute("missing-id");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/n[aã]o encontrado/i);
  });

  it("cross-tenant (mesma id, outro tenant) retorna not found", async () => {
    // findFirst com filtro { id, companyId: "company-A" } volta null para id de outro tenant.
    (prisma.customAttribute.findFirst as Mock).mockResolvedValue(null);

    const res = await getCustomAttribute("attr-de-company-B");

    expect(res.success).toBe(false);
    expect(prisma.customAttribute.findFirst).toHaveBeenCalledWith({
      where: { id: "attr-de-company-B", companyId: "company-A" },
    });
  });
});

// ---------------------------------------------------------------------------
// createCustomAttribute
// ---------------------------------------------------------------------------

const validCreateInput = {
  entity: "lead" as const,
  key: "mrr",
  label: "MRR",
  type: "number" as const,
  required: false,
  isUnique: false,
};

describe("createCustomAttribute", () => {
  it("happy path — cria, revalida tag e loga auditoria", async () => {
    (prisma.customAttribute.count as Mock).mockResolvedValue(5);
    (prisma.customAttribute.create as Mock).mockResolvedValue({
      id: "new-1",
      ...validCreateInput,
      companyId: "company-A",
    });

    const res = await createCustomAttribute(validCreateInput);

    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ id: "new-1", key: "mrr" });
    expect(requirePermission).toHaveBeenCalledWith("custom-attributes:manage");
    expect(prisma.customAttribute.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-A",
        entity: "lead",
        key: "mrr",
        label: "MRR",
        type: "number",
      }),
    });
    expect(revalidateTag).toHaveBeenCalledWith(
      "custom-attrs:company-A:lead",
      "max",
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "custom_attribute",
        action: "created",
        resourceId: "new-1",
        companyId: "company-A",
      }),
    );
  });

  it("cap 30 attrs por entity — retorna erro sem criar", async () => {
    (prisma.customAttribute.count as Mock).mockResolvedValue(30);

    const res = await createCustomAttribute(validCreateInput);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/limite/i);
    expect(prisma.customAttribute.create).not.toHaveBeenCalled();
  });

  it("key reservada — retorna erro sem criar", async () => {
    (prisma.customAttribute.count as Mock).mockResolvedValue(0);

    const res = await createCustomAttribute({
      ...validCreateInput,
      key: "email",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/reservad/i);
    expect(prisma.customAttribute.create).not.toHaveBeenCalled();
  });

  it("options shape inválido para select — retorna erro sem criar", async () => {
    (prisma.customAttribute.count as Mock).mockResolvedValue(0);

    const res = await createCustomAttribute({
      entity: "lead",
      key: "plan",
      label: "Plan",
      type: "select",
      // options precisa ser Array<{value,label}> não-vazio; aqui passamos shape errado.
      options: [{ value: "" }],
    } as never);

    expect(res.success).toBe(false);
    expect(prisma.customAttribute.create).not.toHaveBeenCalled();
  });

  it("sem permissão manage — retorna 403 sem tocar DB", async () => {
    (requirePermission as Mock).mockRejectedValue(
      new PermissionDeniedError("custom-attributes:manage"),
    );

    const res = await createCustomAttribute(validCreateInput);

    expect(res.success).toBe(false);
    expect(prisma.customAttribute.count).not.toHaveBeenCalled();
    expect(prisma.customAttribute.create).not.toHaveBeenCalled();
  });
});
