import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ===== Mocks =====

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customAttributeUniqueRef: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

const mockLoggerWarn = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
}));

const mockFinalizeAdd = vi.fn();

vi.mock("../queues/custom-attr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../queues/custom-attr")>();
  return {
    ...actual,
    finalizeDeleteQueue: { add: mockFinalizeAdd },
    dropIndexQueue: { add: vi.fn() },
  };
});

const { mockPgConnect, mockPgQuery, mockPgEnd, MockClient } = vi.hoisted(() => {
  const connect = vi.fn();
  const query = vi.fn();
  const end = vi.fn();
  const Client = vi.fn(function (this: any, _opts: any) {
    this.connect = connect;
    this.query = query;
    this.end = end;
  });
  return {
    mockPgConnect: connect,
    mockPgQuery: query,
    mockPgEnd: end,
    MockClient: Client,
  };
});

vi.mock("pg", () => ({
  Client: MockClient,
}));

// Dynamic import after mocks
const { processDropIndex } = await import("./custom-attr-drop-index");

function makeJob(data: { entity: string; key: string; defId: string }) {
  return { id: "job-1", data } as any;
}

describe("processDropIndex (T10)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({ rowCount: 0 });
    mockPgEnd.mockResolvedValue(undefined);
    mockFinalizeAdd.mockResolvedValue({ id: "fd-1" });
    process.env.DATABASE_URL = "postgresql://db/x";
    process.env.DIRECT_URL = "postgresql://direct/x";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejeita key inválida (KEY_REGEX)", async () => {
    await expect(
      processDropIndex(makeJob({ entity: "lead", key: "BAD-KEY!", defId: "def-1" })),
    ).rejects.toThrow(/invalid key/i);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejeita entity fora de ALLOWED_ENTITIES", async () => {
    await expect(
      processDropIndex(makeJob({ entity: "invalid", key: "mrr", defId: "def-1" })),
    ).rejects.toThrow(/invalid entity/i);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("refCount > 1 → decrementa e NÃO dropa index (2→1)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ref-1",
      entity: "lead",
      key: "mrr",
      refCount: 2,
      indexName: "idx_leads_custom_mrr_unique",
    });
    mockUpdate.mockResolvedValue({});

    const result = await processDropIndex(
      makeJob({ entity: "lead", key: "mrr", defId: "def-1" }),
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ref-1" },
      data: { refCount: { decrement: 1 } },
    });
    expect(mockPgConnect).not.toHaveBeenCalled();
    expect(mockPgQuery).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockFinalizeAdd).toHaveBeenCalledWith(
      "finalize-def-1",
      { defId: "def-1" },
      { jobId: "fd:def-1" },
    );
    expect(result).toEqual({ dropped: false, refCount: 1 });
  });

  it("refCount === 1 → DROP INDEX CONCURRENTLY + delete ref (1→0)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ref-1",
      entity: "lead",
      key: "mrr",
      refCount: 1,
      indexName: "idx_leads_custom_mrr_unique",
    });
    mockDelete.mockResolvedValue({});

    const result = await processDropIndex(
      makeJob({ entity: "lead", key: "mrr", defId: "def-1" }),
    );

    expect(mockPgConnect).toHaveBeenCalled();
    expect(mockPgQuery).toHaveBeenCalledWith(
      expect.stringMatching(
        /DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+"idx_leads_custom_mrr_unique"/,
      ),
    );
    expect(mockPgEnd).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ref-1" } });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockFinalizeAdd).toHaveBeenCalledWith(
      "finalize-def-1",
      { defId: "def-1" },
      { jobId: "fd:def-1" },
    );
    expect(result).toEqual({ dropped: true, refCount: 0 });
  });

  it("ref não existe → warn + no-op idempotente + enqueue finalize", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await processDropIndex(
      makeJob({ entity: "lead", key: "mrr", defId: "def-1" }),
    );

    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPgConnect).not.toHaveBeenCalled();
    expect(mockFinalizeAdd).toHaveBeenCalledWith(
      "finalize-def-1",
      { defId: "def-1" },
      { jobId: "fd:def-1" },
    );
    expect(result).toEqual({ dropped: false, refCount: 0 });
  });

  it("usa DIRECT_URL com fallback para DATABASE_URL + warn", async () => {
    delete process.env.DIRECT_URL;
    mockFindUnique.mockResolvedValue({
      id: "ref-1",
      entity: "lead",
      key: "mrr",
      refCount: 1,
      indexName: "idx_leads_custom_mrr_unique",
    });
    mockDelete.mockResolvedValue({});

    await processDropIndex(makeJob({ entity: "lead", key: "mrr", defId: "def-1" }));

    expect(MockClient).toHaveBeenCalledWith({ connectionString: "postgresql://db/x" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringMatching(/fallback/i),
    );
  });

  it("enqueue finalize-delete-def sempre com jobId fd:<defId>", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ref-1",
      entity: "lead",
      key: "mrr",
      refCount: 1,
      indexName: "idx_leads_custom_mrr_unique",
    });
    mockDelete.mockResolvedValue({});

    await processDropIndex(makeJob({ entity: "lead", key: "mrr", defId: "def-abc" }));

    expect(mockFinalizeAdd).toHaveBeenCalledWith(
      "finalize-def-abc",
      { defId: "def-abc" },
      { jobId: "fd:def-abc" },
    );
  });
});
