/**
 * Fase 5 — T11/34: processor custom-attr-purge-values.
 * Spec v3 §3.8 + Plan v3 CR-3.
 *
 * Red: testes que validam loop idempotente de UPDATE sem OFFSET,
 * retomada após crash (affected=0), chain com dropIndex ou finalizeDelete,
 * e validação de KEY_REGEX + ALLOWED_TABLES.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const executeRawMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: (sql: string, ...args: unknown[]) =>
      executeRawMock(sql, ...args),
  },
}));

const dropIndexAdd = vi.fn(async (..._args: unknown[]) => ({ id: "drop-job-1" }));
const finalizeAdd = vi.fn(async (..._args: unknown[]) => ({ id: "fin-job-1" }));

vi.mock("../queues/custom-attr", () => ({
  CUSTOM_ATTR_PURGE_VALUES_QUEUE: "custom-attr-purge-values",
  dropIndexQueue: {
    add: (name: string, payload: unknown, opts: unknown) =>
      dropIndexAdd(name, payload, opts),
  },
  finalizeDeleteQueue: {
    add: (name: string, payload: unknown, opts: unknown) =>
      finalizeAdd(name, payload, opts),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {},
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProcessFn = typeof import("./custom-attr-purge-values").processPurgeValues;

async function importProcessor(): Promise<ProcessFn> {
  const mod = await import("./custom-attr-purge-values");
  return mod.processPurgeValues;
}

function makeJob(overrides: Partial<{
  entity: string;
  key: string;
  companyId: string;
  defId: string;
  indexHandoff: boolean;
}> = {}) {
  const data = {
    entity: "lead",
    key: "tier",
    companyId: "11111111-1111-1111-1111-111111111111",
    defId: "22222222-2222-2222-2222-222222222222",
    indexHandoff: false,
    ...overrides,
  };
  return {
    id: "job-1",
    data,
    updateProgress: vi.fn(async () => undefined),
  } as unknown as Parameters<ProcessFn>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  executeRawMock.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("processPurgeValues (T11)", () => {
  it("loops until affected===0 e soma totalPurged (500,200,0 → 700)", async () => {
    executeRawMock
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(0);

    const processPurgeValues = await importProcessor();
    const job = makeJob({ indexHandoff: false });

    const result = await processPurgeValues(job);

    expect(executeRawMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ totalPurged: 700 });
    expect(job.updateProgress).toHaveBeenCalledTimes(2);
    expect(job.updateProgress).toHaveBeenNthCalledWith(1, { purged: 500 });
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, { purged: 700 });
  });

  it("retomada idempotente: affected=0 imediato → totalPurged=0 e chain executa", async () => {
    executeRawMock.mockResolvedValueOnce(0);

    const processPurgeValues = await importProcessor();
    const job = makeJob({ indexHandoff: false });

    const result = await processPurgeValues(job);

    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ totalPurged: 0 });
    expect(job.updateProgress).not.toHaveBeenCalled();
    expect(finalizeAdd).toHaveBeenCalledTimes(1);
  });

  it("indexHandoff=true enfileira dropIndexQueue com jobId determinístico", async () => {
    executeRawMock.mockResolvedValueOnce(0);

    const processPurgeValues = await importProcessor();
    const job = makeJob({
      entity: "contact",
      key: "score",
      defId: "def-xyz",
      indexHandoff: true,
    });

    await processPurgeValues(job);

    expect(dropIndexAdd).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = dropIndexAdd.mock.calls[0]!;
    expect(name).toBe("drop-contact-score");
    expect(payload).toEqual({ entity: "contact", key: "score", defId: "def-xyz" });
    expect(opts).toEqual({ jobId: "di:contact:score" });
    expect(finalizeAdd).not.toHaveBeenCalled();
  });

  it("indexHandoff=false enfileira finalizeDeleteQueue com jobId determinístico", async () => {
    executeRawMock.mockResolvedValueOnce(0);

    const processPurgeValues = await importProcessor();
    const job = makeJob({
      entity: "opportunity",
      defId: "def-abc",
      indexHandoff: false,
    });

    await processPurgeValues(job);

    expect(finalizeAdd).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = finalizeAdd.mock.calls[0]!;
    expect(name).toBe("finalize-def-abc");
    expect(payload).toEqual({ defId: "def-abc" });
    expect(opts).toEqual({ jobId: "fd:def-abc" });
    expect(dropIndexAdd).not.toHaveBeenCalled();
  });

  it("rejeita key fora do KEY_REGEX", async () => {
    const processPurgeValues = await importProcessor();
    const job = makeJob({ key: "Invalid-Key!" });

    await expect(processPurgeValues(job)).rejects.toThrow(/invalid key/i);
    expect(executeRawMock).not.toHaveBeenCalled();
    expect(dropIndexAdd).not.toHaveBeenCalled();
    expect(finalizeAdd).not.toHaveBeenCalled();
  });

  it("rejeita entity fora de ALLOWED_TABLES", async () => {
    const processPurgeValues = await importProcessor();
    const job = makeJob({ entity: "companies" });

    await expect(processPurgeValues(job)).rejects.toThrow(/invalid entity/i);
    expect(executeRawMock).not.toHaveBeenCalled();
    expect(dropIndexAdd).not.toHaveBeenCalled();
    expect(finalizeAdd).not.toHaveBeenCalled();
  });
});
