/**
 * Fase 33 — Saved Filters server actions.
 *
 * Valida limite 20, setDefault transacional, ownership em delete/update,
 * listSavedFilters filtra por escopo, duplicate name, e updateFilter com
 * setAsDefault=true delegando para transação.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedFilter: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => {
      return Promise.all(ops.map((op) => Promise.resolve(op)));
    }),
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

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { getCurrentUser } from "@/lib/auth";
import {
  listSavedFilters,
  saveFilter,
  updateFilter,
  deleteFilter,
  setDefaultFilter,
} from "../saved-filters";

const USER = { id: "user-1", name: "U", email: "u@x.com", isSuperAdmin: false, platformRole: "admin", avatarUrl: null, theme: "dark" };
const COMPANY_ID = "company-A";

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(USER);
  (requireActiveCompanyId as ReturnType<typeof vi.fn>).mockResolvedValue(COMPANY_ID);
  (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue(USER);
});

describe("saveFilter — limite 20", () => {
  it("rejeita o 21º com mensagem PT-BR", async () => {
    (prisma.savedFilter.count as ReturnType<typeof vi.fn>).mockResolvedValue(20);
    const r = await saveFilter({
      moduleKey: "leads",
      name: "Meu filtro",
      filters: { status: "new" },
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Limite de 20");
    expect(prisma.savedFilter.create).not.toHaveBeenCalled();
  });

  it("cria quando count < 20", async () => {
    (prisma.savedFilter.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (prisma.savedFilter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.savedFilter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sf-1",
      userId: USER.id,
      companyId: COMPANY_ID,
      moduleKey: "leads",
      name: "Meu filtro",
      filters: { status: "new" },
      isDefault: false,
    });
    const r = await saveFilter({
      moduleKey: "leads",
      name: "Meu filtro",
      filters: { status: "new" },
    });
    expect(r.success).toBe(true);
    expect(prisma.savedFilter.create).toHaveBeenCalledOnce();
  });
});

describe("setDefaultFilter — transacional", () => {
  it("unset anterior + set novo em $transaction", async () => {
    (prisma.savedFilter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sf-2" });
    const updatedRow = { id: "sf-2", isDefault: true };
    (prisma.savedFilter.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.savedFilter.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedRow);

    const r = await setDefaultFilter({
      moduleKey: "leads",
      id: "11111111-1111-4111-a111-111111111111",
    });
    expect(r.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.savedFilter.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER.id,
        companyId: COMPANY_ID,
        moduleKey: "leads",
        isDefault: true,
      },
      data: { isDefault: false },
    });
  });
});

describe("deleteFilter — ownership", () => {
  it("where inclui userId + companyId (ownership enforce)", async () => {
    (prisma.savedFilter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ moduleKey: "leads" });
    (prisma.savedFilter.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sf-3" });
    const r = await deleteFilter("sf-3");
    expect(r.success).toBe(true);
    expect(prisma.savedFilter.findFirst).toHaveBeenCalledWith({
      where: { id: "sf-3", userId: USER.id, companyId: COMPANY_ID },
      select: { moduleKey: true },
    });
  });

  it("retorna erro quando não encontrado (cross-user)", async () => {
    (prisma.savedFilter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await deleteFilter("sf-999");
    expect(r.success).toBe(false);
    expect(r.error).toBe("Filtro não encontrado");
    expect(prisma.savedFilter.delete).not.toHaveBeenCalled();
  });
});

describe("listSavedFilters — escopo", () => {
  it("filtra por userId+companyId+moduleKey", async () => {
    (prisma.savedFilter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listSavedFilters({ moduleKey: "contacts" });
    expect(prisma.savedFilter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER.id,
          companyId: COMPANY_ID,
          moduleKey: "contacts",
        },
      }),
    );
  });
});

describe("saveFilter — nome duplicado", () => {
  it("retorna erro PT-BR quando já existe filtro com mesmo nome", async () => {
    (prisma.savedFilter.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (prisma.savedFilter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sf-existing",
    });
    const r = await saveFilter({
      moduleKey: "leads",
      name: "Dup",
      filters: {},
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Já existe");
    expect(prisma.savedFilter.create).not.toHaveBeenCalled();
  });
});

describe("updateFilter — setAsDefault delega para transação", () => {
  it("dispara $transaction com updateMany unset + update set", async () => {
    (prisma.savedFilter.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      moduleKey: "leads",
    });
    (prisma.savedFilter.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.savedFilter.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "22222222-2222-4222-a222-222222222222",
      isDefault: true,
    });
    const r = await updateFilter({
      id: "22222222-2222-4222-a222-222222222222",
      setAsDefault: true,
    });
    expect(r.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.savedFilter.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER.id,
        companyId: COMPANY_ID,
        moduleKey: "leads",
        isDefault: true,
      },
      data: { isDefault: false },
    });
  });
});
