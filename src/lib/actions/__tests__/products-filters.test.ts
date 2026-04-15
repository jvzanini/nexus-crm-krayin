/**
 * Fase 32 — Filtros URL em /products.
 *
 * Valida que `listProducts` monta o `where` do Prisma corretamente a partir
 * do shape URL (ProductsFiltersSchema) e que faz fallback silencioso quando
 * o input não passa no Zod.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      userCompanyMembership: { findFirst: vi.fn() },
      product: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listProducts } from "../products";

const mockUser = {
  id: "user-1",
  email: "u@x.com",
  name: "User",
  platformRole: "admin",
  isSuperAdmin: false,
} as unknown;

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  (
    prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>
  ).mockResolvedValue({ companyId: "company-A" });
  (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("listProducts — filtros URL (ProductsFiltersSchema)", () => {
  it("q monta OR name/sku case-insensitive", async () => {
    await listProducts({ q: "widget" });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-A",
          OR: [
            { name: { contains: "widget", mode: "insensitive" } },
            { sku: { contains: "widget", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("active='active' vira where.active=true", async () => {
    await listProducts({ active: "active" });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-A",
          active: true,
        }),
      }),
    );
  });

  it("active='inactive' vira where.active=false", async () => {
    await listProducts({ active: "inactive" });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-A",
          active: false,
        }),
      }),
    );
  });

  it("category monta where.category exato", async () => {
    await listProducts({ category: "Software" });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-A",
          category: "Software",
        }),
      }),
    );
  });

  it("raw inválido (active='foo') cai em fallback silencioso sem filtros", async () => {
    await listProducts({ active: "foo" });
    const call = (
      prisma.product.findMany as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0];
    expect(call.where).toEqual({ companyId: "company-A" });
  });

  it("sem args aplica apenas tenant-scope", async () => {
    await listProducts();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-A" },
      }),
    );
  });

  it("compat backward: shape antigo { active: boolean } continua funcionando", async () => {
    // Zod vai falhar (active não é 'active'|'inactive') → cai no fallback legacy
    // que mapeia boolean direto.
    await listProducts({ active: true });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });
});
