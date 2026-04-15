import { describe, it, expect, vi } from "vitest";
import { sha256Hex, findDuplicate } from "../dedupe";

describe("sha256Hex", () => {
  it("é determinístico e hex de 64 chars", () => {
    const h1 = sha256Hex(Buffer.from("hello world"));
    const h2 = sha256Hex(Buffer.from("hello world"));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("findDuplicate", () => {
  const baseNow = new Date("2026-04-15T12:00:00Z");

  it("retorna match quando job existe dentro da janela de 24h", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    const fakeJob = { id: "job-1" };
    const prisma = {
      dataTransferJob: {
        findFirst: vi.fn().mockResolvedValue(fakeJob),
      },
    };
    const r = await findDuplicate({
      prisma: prisma as any,
      companyId: "co-1",
      entity: "lead",
      fileHash: "abc",
    });
    expect(r).toEqual(fakeJob);
    const args = prisma.dataTransferJob.findFirst.mock.calls[0]![0];
    expect(args.where.companyId).toBe("co-1");
    expect(args.where.entity).toBe("lead");
    expect(args.where.fileHash).toBe("abc");
    expect(args.where.direction).toBe("import");
    expect(args.where.status.not).toBe("failed");
    // Janela 24h: createdAt >= now - 24h
    const cutoff = new Date(baseNow.getTime() - 24 * 3600 * 1000);
    expect(args.where.createdAt.gte.toISOString()).toBe(cutoff.toISOString());
    vi.useRealTimers();
  });

  it("retorna null quando nenhum match dentro de 24h", async () => {
    const prisma = {
      dataTransferJob: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const r = await findDuplicate({
      prisma: prisma as any,
      companyId: "co-1",
      entity: "contact",
      fileHash: "zzz",
    });
    expect(r).toBeNull();
  });
});
