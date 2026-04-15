import { describe, it, expect, vi } from "vitest";
import { createLookupContext } from "../lookup";

describe("createLookupContext", () => {
  it("lookupOwner retorna id quando match por email", async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: "u1", name: "Alice", email: "alice@x.com" },
          { id: "u2", name: "Bob", email: "bob@x.com" },
        ]),
      },
    };
    const ctx = createLookupContext({
      prisma: prisma as any,
      companyId: "co-1",
      entity: "lead",
    });
    expect(await ctx.lookupOwner("alice@x.com")).toBe("u1");
    expect(await ctx.lookupOwner("Bob")).toBe("u2");
  });

  it("lookupOwner retorna null quando miss", async () => {
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const ctx = createLookupContext({
      prisma: prisma as any,
      companyId: "co-1",
      entity: "lead",
    });
    expect(await ctx.lookupOwner("nobody@x.com")).toBeNull();
  });

  it("lookupOwner usa cache (1 query para múltiplas chamadas)", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@x.com" },
    ]);
    const prisma = { user: { findMany } };
    const ctx = createLookupContext({
      prisma: prisma as any,
      companyId: "co-1",
      entity: "lead",
    });
    await ctx.lookupOwner("alice@x.com");
    await ctx.lookupOwner("alice@x.com");
    await ctx.lookupOwner("Alice");
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("lookupStatus mapeia label PT→enum", () => {
    const ctx = createLookupContext({
      prisma: {} as any,
      companyId: "co-1",
      entity: "lead",
    });
    expect(ctx.lookupStatus("Novo")).toBe("new");
    expect(ctx.lookupStatus("contacted")).toBe("contacted");
    expect(ctx.lookupStatus("foo")).toBeNull();
  });

  it("lookupStage mapeia label EN→enum", () => {
    const ctx = createLookupContext({
      prisma: {} as any,
      companyId: "co-1",
      entity: "opportunity",
    });
    expect(ctx.lookupStage("Prospecting")).toBe("prospecting");
    expect(ctx.lookupStage("closed_won")).toBe("closed_won");
    expect(ctx.lookupStage("bogus")).toBeNull();
  });
});
