import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do redis antes de importar o módulo
vi.mock("@/lib/redis", () => ({
  redis: { status: "ready" },
}));

// Mock do BullMQ Queue
const constructed: Array<{ name: string; opts: unknown }> = [];
const mockAdd = vi.fn();

vi.mock("bullmq", () => {
  class MockQueue {
    name: string;
    add = mockAdd;
    constructor(name: string, opts?: unknown) {
      this.name = name;
      constructed.push({ name, opts });
    }
  }
  return { Queue: MockQueue };
});

// Importar após mocks
const mod = await import("../custom-attr");

describe("custom-attr queues", () => {
  beforeEach(() => {
    mockAdd.mockReset();
  });

  it("deve instanciar 4 queues com nomes canônicos", () => {
    const names = constructed.map((c) => c.name);
    expect(names).toContain("custom-attr-create-index");
    expect(names).toContain("custom-attr-drop-index");
    expect(names).toContain("custom-attr-purge-values");
    expect(names).toContain("custom-attr-finalize-delete");
  });

  it("enqueueCreateIndex usa jobId idempotente ci:<entity>:<key>", async () => {
    mockAdd.mockResolvedValue({ id: "ci:lead:score" });
    const id = await mod.enqueueCreateIndex({
      entity: "lead",
      key: "score",
      defId: "def-1",
    });
    expect(id).toBe("ci:lead:score");
    const [, , opts] = mockAdd.mock.calls[0];
    expect(opts.jobId).toBe("ci:lead:score");
    expect(opts.attempts).toBe(5);
  });

  it("enqueueDropIndex usa jobId idempotente di:<entity>:<key>", async () => {
    mockAdd.mockResolvedValue({ id: "di:contact:age" });
    const id = await mod.enqueueDropIndex({
      entity: "contact",
      key: "age",
      defId: "def-2",
    });
    expect(id).toBe("di:contact:age");
    const [, , opts] = mockAdd.mock.calls[0];
    expect(opts.jobId).toBe("di:contact:age");
  });

  it("enqueuePurgeValues usa jobId idempotente purge:<entity>:<key>:<companyId>", async () => {
    mockAdd.mockResolvedValue({ id: "purge:lead:score:co-1" });
    const id = await mod.enqueuePurgeValues({
      entity: "lead",
      key: "score",
      companyId: "co-1",
      defId: "def-3",
      indexHandoff: false,
    });
    expect(id).toBe("purge:lead:score:co-1");
    const [, , opts] = mockAdd.mock.calls[0];
    expect(opts.jobId).toBe("purge:lead:score:co-1");
  });

  it("enqueueFinalizeDelete usa jobId idempotente fd:<defId>", async () => {
    mockAdd.mockResolvedValue({ id: "fd:def-4" });
    const id = await mod.enqueueFinalizeDelete({ defId: "def-4" });
    expect(id).toBe("fd:def-4");
    const [, , opts] = mockAdd.mock.calls[0];
    expect(opts.jobId).toBe("fd:def-4");
  });
});
