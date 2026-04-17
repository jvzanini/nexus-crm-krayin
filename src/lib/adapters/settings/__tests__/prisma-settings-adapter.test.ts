import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    globalSettings: {
      findMany: (...args: unknown[]) => findMany(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

// Import after vi.mock
import { PrismaSettingsAdapter } from "../prisma-settings-adapter";

describe("PrismaSettingsAdapter", () => {
  beforeEach(() => {
    findMany.mockReset();
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("getAllSettings mapeia rows para Record", async () => {
    findMany.mockResolvedValue([
      { key: "platformName", value: "CRM" },
      { key: "maintenanceMode", value: false },
    ]);
    const adapter = new PrismaSettingsAdapter();
    const out = await adapter.getAllSettings();
    expect(out).toEqual({ platformName: "CRM", maintenanceMode: false });
  });

  it("getSetting retorna null quando ausente", async () => {
    findUnique.mockResolvedValue(null);
    const adapter = new PrismaSettingsAdapter();
    expect(await adapter.getSetting("x")).toBeNull();
  });

  it("setSetting chama upsert com updatedBy", async () => {
    upsert.mockResolvedValue({});
    const adapter = new PrismaSettingsAdapter();
    await adapter.setSetting("platformName", "CRM", "user-1");
    expect(upsert).toHaveBeenCalledWith({
      where: { key: "platformName" },
      update: { value: "CRM", updatedBy: "user-1" },
      create: { key: "platformName", value: "CRM", updatedBy: "user-1" },
    });
  });
});
