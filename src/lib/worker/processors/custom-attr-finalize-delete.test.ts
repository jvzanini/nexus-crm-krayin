/**
 * Fase 5 — Custom Attributes: processor finalize-delete (T11.5/34).
 * Spec v3 — último elo delete chain: purge → [drop-index] → finalize.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customAttribute: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
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
import { revalidateTag } from "next/cache";
import { auditLog } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

import { processFinalizeDelete } from "./custom-attr-finalize-delete";

type Mock = ReturnType<typeof vi.fn>;

const makeJob = (defId: string) =>
  ({ id: "job-1", data: { defId } }) as unknown as Parameters<
    typeof processFinalizeDelete
  >[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processFinalizeDelete", () => {
  it("deleta def com status=deleting, invalida cache e gera audit log", async () => {
    (prisma.customAttribute.findUnique as Mock).mockResolvedValue({
      id: "def-1",
      companyId: "company-1",
      entity: "lead",
      key: "priority",
      status: "deleting",
    });
    (prisma.customAttribute.delete as Mock).mockResolvedValue({ id: "def-1" });

    const result = await processFinalizeDelete(makeJob("def-1"));

    expect(prisma.customAttribute.delete).toHaveBeenCalledWith({
      where: { id: "def-1" },
    });
    expect(revalidateTag).toHaveBeenCalledWith(
      "custom-attrs:company-1:lead",
      "max",
    );
    expect(result).toEqual({ deleted: true });
  });

  it("chama auditLog com resourceType=custom_attribute, action=deleted e removed=[key]", async () => {
    (prisma.customAttribute.findUnique as Mock).mockResolvedValue({
      id: "def-2",
      companyId: "company-2",
      entity: "contact",
      key: "vip",
      status: "deleting",
    });
    (prisma.customAttribute.delete as Mock).mockResolvedValue({ id: "def-2" });

    await processFinalizeDelete(makeJob("def-2"));

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "custom_attribute",
        action: "deleted",
        resourceId: "def-2",
        companyId: "company-2",
        after: { removed: ["vip"] },
      }),
    );
  });

  it("no-op (warn + not_found) quando def não existe", async () => {
    (prisma.customAttribute.findUnique as Mock).mockResolvedValue(null);

    const result = await processFinalizeDelete(makeJob("missing"));

    expect(prisma.customAttribute.delete).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(result).toEqual({ deleted: false, reason: "not_found" });
  });

  it("no-op (warn + not_deleting) quando def está com status=active (segurança)", async () => {
    (prisma.customAttribute.findUnique as Mock).mockResolvedValue({
      id: "def-3",
      companyId: "company-3",
      entity: "lead",
      key: "ok",
      status: "active",
    });

    const result = await processFinalizeDelete(makeJob("def-3"));

    expect(prisma.customAttribute.delete).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(result).toEqual({ deleted: false, reason: "not_deleting" });
  });
});
