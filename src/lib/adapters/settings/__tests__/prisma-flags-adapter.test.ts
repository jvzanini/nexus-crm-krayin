import { describe, it, expect, vi, beforeEach } from "vitest";

const listFlagsMock = vi.fn();
const setFlagMock = vi.fn();
const overrideFlagMock = vi.fn();
const clearOverrideMock = vi.fn();

vi.mock("@/lib/flags/index", () => ({
  listFlags: (...a: unknown[]) => listFlagsMock(...a),
  setFlag: (...a: unknown[]) => setFlagMock(...a),
  overrideFlag: (...a: unknown[]) => overrideFlagMock(...a),
  clearOverride: (...a: unknown[]) => clearOverrideMock(...a),
}));

import { PrismaFlagsAdapter } from "../prisma-flags-adapter";

describe("PrismaFlagsAdapter", () => {
  beforeEach(() => {
    listFlagsMock.mockReset();
    setFlagMock.mockReset();
    overrideFlagMock.mockReset();
    clearOverrideMock.mockReset();
  });

  it("list mapeia overrides", async () => {
    const now = new Date();
    listFlagsMock.mockResolvedValue([
      {
        key: "beta",
        description: null,
        enabled: true,
        rolloutPct: 50,
        updatedAt: now,
        overrides: [
          { id: "o1", key: "beta", scope: "company", scopeId: "c1", enabled: true },
        ],
      },
    ]);
    const adapter = new PrismaFlagsAdapter();
    const out = await adapter.list();
    expect(out).toHaveLength(1);
    expect(out[0].overrides).toEqual([
      { scope: "company", scopeId: "c1", enabled: true },
    ]);
    expect(out[0].rolloutPct).toBe(50);
  });

  it("set delega ao helper setFlag com patch", async () => {
    setFlagMock.mockResolvedValue(undefined);
    const adapter = new PrismaFlagsAdapter();
    await adapter.set({ key: "beta", enabled: true, rolloutPct: 30 }, "user-1");
    expect(setFlagMock).toHaveBeenCalledWith(
      "beta",
      { enabled: true, rolloutPct: 30 },
      { userId: "user-1" },
    );
  });

  it("setOverride delega ao helper overrideFlag", async () => {
    overrideFlagMock.mockResolvedValue(undefined);
    const adapter = new PrismaFlagsAdapter();
    await adapter.setOverride({
      key: "beta",
      scope: "user",
      scopeId: "u1",
      enabled: false,
    });
    expect(overrideFlagMock).toHaveBeenCalledWith("beta", "user", "u1", false);
  });

  it("clearOverride delega ao helper clearOverride", async () => {
    clearOverrideMock.mockResolvedValue(undefined);
    const adapter = new PrismaFlagsAdapter();
    await adapter.clearOverride("beta", "company", "c1");
    expect(clearOverrideMock).toHaveBeenCalledWith("beta", "company", "c1");
  });
});
