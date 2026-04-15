/**
 * Fase 32 — filtros URL em /tasks.
 * Valida a construção de `where` em `listTasks` para:
 *  - status
 *  - assigneeScope (me | all com manager | all com viewer clamp)
 *  - dueWithinDays (overdue)
 *  - q (OR em title/description)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks de dependências externas -----------------------------------------

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      userCompanyMembership: { findFirst: vi.fn() },
      activity: {
        findMany: vi.fn(),
      },
      activityFile: { findMany: vi.fn() },
    },
  };
});

vi.mock("@/lib/rbac", () => {
  class PermissionDeniedError extends Error {}
  return {
    requirePermission: vi.fn(),
    PermissionDeniedError,
  };
});

vi.mock("@/lib/tenant", () => ({
  requireCompanyRole: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn,
}));

vi.mock("@/lib/automation/dispatcher", () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock("@/lib/worker/queues/activity-reminders", () => ({
  scheduleReminder: vi.fn(async () => null),
  cancelReminder: vi.fn(async () => undefined),
}));

vi.mock("@/lib/files", () => ({
  getFileDriver: () => ({ put: vi.fn(), get: vi.fn(), delete: vi.fn() }),
  enforceMime: vi.fn(),
  enforceSize: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// --- Imports depois dos mocks -----------------------------------------------

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireCompanyRole } from "@/lib/tenant";
import { logger } from "@/lib/logger";
import { listTasks } from "../activities";

const mockUser = {
  id: "user-1",
  email: "u@x.com",
  name: "User",
  platformRole: "admin",
  isSuperAdmin: false,
} as any;

const memFindFirst = () =>
  prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>;
const activityFindMany = () =>
  prisma.activity.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  memFindFirst().mockResolvedValue({ companyId: "company-A" });
  activityFindMany().mockResolvedValue([]);
});

describe("listTasks — filtros URL (Fase 32)", () => {
  it("aplica status=pending em where.status", async () => {
    await listTasks({ status: "pending" });
    expect(activityFindMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-A",
          type: "task",
          status: "pending",
          assignedTo: "user-1",
        }),
      }),
    );
  });

  it("assigneeScope=me (default) aplica assignedTo=user.id", async () => {
    await listTasks({ assigneeScope: "me" });
    expect(activityFindMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-A",
          assignedTo: "user-1",
        }),
      }),
    );
  });

  it("assigneeScope=all + manager/admin NÃO seta assignedTo (vê todos)", async () => {
    (requireCompanyRole as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await listTasks({ assigneeScope: "all" });
    const call = activityFindMany().mock.calls[0]?.[0] as any;
    expect(call.where.companyId).toBe("company-A");
    expect(call.where.type).toBe("task");
    expect(call.where.assignedTo).toBeUndefined();
  });

  it("assigneeScope=all + viewer (não manager) faz clamp para me + warn", async () => {
    (requireCompanyRole as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await listTasks({ assigneeScope: "all" });
    expect(activityFindMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedTo: "user-1" }),
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      expect.stringContaining("clamped"),
    );
  });

  it("dueWithinDays=overdue → where.dueAt={lt:now}, status=pending", async () => {
    await listTasks({ dueWithinDays: "overdue" });
    const call = activityFindMany().mock.calls[0]?.[0] as any;
    expect(call.where.dueAt).toEqual(expect.objectContaining({ lt: expect.any(Date) }));
    expect(call.where.status).toBe("pending");
  });

  it("q monta OR case-insensitive em title e description", async () => {
    await listTasks({ q: "reunião" });
    const call = activityFindMany().mock.calls[0]?.[0] as any;
    expect(call.where.OR).toEqual([
      { title: { contains: "reunião", mode: "insensitive" } },
      { description: { contains: "reunião", mode: "insensitive" } },
    ]);
  });
});
