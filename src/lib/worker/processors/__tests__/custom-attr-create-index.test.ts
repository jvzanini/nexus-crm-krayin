/**
 * Fase 5 — Custom Attributes: processor `custom-attr-create-index` (T9/34).
 * Spec v3 §3.3 + Plan v3 CR-3 (KEY_REGEX + ALLOWED_TABLES).
 *
 * Cobre:
 * - Primeiro uso de (entity,key): cria unique index + insere ref refCount=1.
 * - Segundo uso (ref existe): apenas increment refCount, não toca pg.
 * - Idempotência: roda duas vezes sem existing ref, segunda detecta index existente
 *   via pg_indexes e não recria — mas a lógica real não permite esse cenário
 *   (existing ref curto-circuita). Validamos que se SELECT retorna rowCount>0,
 *   não chamamos CREATE INDEX.
 * - KEY_REGEX rejeita chaves inválidas.
 * - ALLOWED_ENTITIES rejeita entidades fora da lista.
 * - Fallback DIRECT_URL → DATABASE_URL com logger.warn.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks de prisma ----
const findUnique = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customAttributeUniqueRef: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));

// ---- Mocks de pg.Client ----
const pgQuery = vi.fn();
const pgConnect = vi.fn();
const pgEnd = vi.fn();
const ClientCtor = vi.fn();

vi.mock("pg", () => {
  return {
    Client: class {
      constructor(opts: unknown) {
        ClientCtor(opts);
      }
      connect = (...a: unknown[]) => pgConnect(...a);
      query = (...a: unknown[]) => pgQuery(...a);
      end = (...a: unknown[]) => pgEnd(...a);
    },
  };
});

// ---- Mocks de logger ----
const loggerWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: (...a: unknown[]) => loggerWarn(...a),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import sob-mock
import { processCreateIndex } from "../custom-attr-create-index";

type FakeJob = { id?: string; data: { entity: string; key: string; defId?: string } };

function mkJob(entity: string, key: string): FakeJob {
  return { id: "j1", data: { entity, key, defId: "d1" } };
}

describe("processCreateIndex (T9/34)", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    create.mockReset();
    pgQuery.mockReset();
    pgConnect.mockReset();
    pgEnd.mockReset();
    ClientCtor.mockReset();
    loggerWarn.mockReset();
    process.env = { ...origEnv, DIRECT_URL: "postgres://direct", DATABASE_URL: "postgres://db" };
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("primeiro uso cria unique index e insere ref com refCount=1", async () => {
    findUnique.mockResolvedValue(null);
    pgQuery
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // SELECT pg_indexes
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // CREATE UNIQUE INDEX
    create.mockResolvedValue({ id: "r1" });

    const res = await processCreateIndex(mkJob("lead", "cpf") as never);

    expect(res).toEqual({ created: true, refCount: 1 });
    expect(pgConnect).toHaveBeenCalledTimes(1);
    expect(pgEnd).toHaveBeenCalledTimes(1);
    expect(pgQuery).toHaveBeenCalledTimes(2);
    // SELECT parametrizado
    expect(pgQuery.mock.calls[0][0]).toMatch(/SELECT 1 FROM pg_indexes/i);
    // CREATE contém nome do index, tabela "leads" e cláusula WHERE
    const createSql = pgQuery.mock.calls[1][0] as string;
    expect(createSql).toMatch(/CREATE UNIQUE INDEX CONCURRENTLY/i);
    expect(createSql).toContain(`"idx_lead_custom_cpf_unique"`);
    expect(createSql).toMatch(/ON leads /);
    expect(createSql).toMatch(/WHERE custom \? \$1/);
    expect(pgQuery.mock.calls[1][1]).toEqual(["cpf"]);
    expect(create).toHaveBeenCalledWith({
      data: {
        entity: "lead",
        key: "cpf",
        refCount: 1,
        indexName: "idx_lead_custom_cpf_unique",
      },
    });
  });

  it("segundo uso com ref existente apenas incrementa refCount (não toca pg)", async () => {
    findUnique.mockResolvedValue({ id: "r1", entity: "lead", key: "cpf", refCount: 1 });
    update.mockResolvedValue({ id: "r1", refCount: 2 });

    const res = await processCreateIndex(mkJob("lead", "cpf") as never);

    expect(res).toEqual({ created: false, refCount: 2 });
    expect(update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { refCount: { increment: 1 } },
    });
    expect(pgConnect).not.toHaveBeenCalled();
    expect(pgQuery).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("idempotência: detecta index já existente via pg_indexes e não chama CREATE INDEX", async () => {
    findUnique.mockResolvedValue(null);
    pgQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ "?column?": 1 }] });
    create.mockResolvedValue({ id: "r1" });

    const res = await processCreateIndex(mkJob("contact", "email_extra") as never);

    expect(res).toEqual({ created: true, refCount: 1 });
    expect(pgQuery).toHaveBeenCalledTimes(1); // só o SELECT
    expect(pgQuery.mock.calls[0][1]).toEqual(["idx_contact_custom_email_extra_unique"]);
    expect(create).toHaveBeenCalled();
    expect(pgEnd).toHaveBeenCalled();
  });

  it("KEY_REGEX rejeita chave inválida", async () => {
    await expect(processCreateIndex(mkJob("lead", "Invalid-Key!") as never)).rejects.toThrow(
      /invalid key/i,
    );
    await expect(processCreateIndex(mkJob("lead", "1starts_with_digit") as never)).rejects.toThrow(
      /invalid key/i,
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(pgConnect).not.toHaveBeenCalled();
  });

  it("ALLOWED_ENTITIES rejeita entidade fora da lista", async () => {
    await expect(processCreateIndex(mkJob("user", "cpf") as never)).rejects.toThrow(
      /invalid entity/i,
    );
    await expect(processCreateIndex(mkJob("leads", "cpf") as never)).rejects.toThrow(
      /invalid entity/i,
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(pgConnect).not.toHaveBeenCalled();
  });

  it("usa DIRECT_URL quando definida, sem warn", async () => {
    process.env.DIRECT_URL = "postgres://direct-url";
    process.env.DATABASE_URL = "postgres://db-url";
    findUnique.mockResolvedValue(null);
    pgQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    create.mockResolvedValue({ id: "r1" });

    await processCreateIndex(mkJob("opportunity", "deal_score") as never);

    expect(ClientCtor).toHaveBeenCalledWith({ connectionString: "postgres://direct-url" });
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it("fallback para DATABASE_URL quando DIRECT_URL ausente e loga warn", async () => {
    delete process.env.DIRECT_URL;
    process.env.DATABASE_URL = "postgres://db-url-fallback";
    findUnique.mockResolvedValue(null);
    pgQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    create.mockResolvedValue({ id: "r1" });

    await processCreateIndex(mkJob("opportunity", "deal_score") as never);

    expect(ClientCtor).toHaveBeenCalledWith({ connectionString: "postgres://db-url-fallback" });
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const msg = loggerWarn.mock.calls[0].slice(-1)[0] as string;
    expect(msg).toMatch(/DATABASE_URL fallback/i);
  });
});
