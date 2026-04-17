import { describe, it, expect, vi, beforeEach } from "vitest";
import { chainDepthExceeded, incrementQuotaOrReject, CHAIN_DEPTH_MAX, DEFAULT_DAILY_QUOTA } from "../guards";

// ---------------------------------------------------------------------------
// Mock redis
// ---------------------------------------------------------------------------
vi.mock("@/lib/redis", () => {
  const store: Record<string, number> = {};
  return {
    redis: {
      incr: vi.fn(async (key: string) => {
        store[key] = (store[key] ?? 0) + 1;
        return store[key];
      }),
      expire: vi.fn(async () => 1),
      set: vi.fn(async () => "OK"),
      _store: store,
      _reset: () => { for (const k in store) delete store[k]; },
    },
  };
});

// Mock prisma — não chamado em incrementQuotaOrReject diretamente (só em notifyQuotaExceededOnce via redis.set)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(async () => {}),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// chainDepthExceeded
// ---------------------------------------------------------------------------
describe("chainDepthExceeded", () => {
  it("retorna false para chainDepth < MAX (9)", () => {
    expect(chainDepthExceeded(9)).toBe(false);
  });

  it("retorna true para chainDepth === MAX (10)", () => {
    expect(chainDepthExceeded(10)).toBe(true);
  });

  it("retorna true para chainDepth > MAX (11)", () => {
    expect(chainDepthExceeded(11)).toBe(true);
  });

  it("retorna false para chainDepth 0", () => {
    expect(chainDepthExceeded(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// incrementQuotaOrReject
// ---------------------------------------------------------------------------
describe("incrementQuotaOrReject", () => {
  let redisMock: any;

  beforeEach(async () => {
    const mod = await import("@/lib/redis");
    redisMock = (mod as any).redis;
    vi.clearAllMocks();
    // Reset contagem interna
    redisMock._reset();
  });

  it("primeiro incr define TTL 26h e retorna over=false", async () => {
    const result = await incrementQuotaOrReject("company-1", DEFAULT_DAILY_QUOTA);
    expect(result.over).toBe(false);
    expect(result.count).toBe(1);
    expect(redisMock.expire).toHaveBeenCalledOnce();
    const [, ttl] = redisMock.expire.mock.calls[0];
    expect(ttl).toBe(26 * 60 * 60);
  });

  it("segundo incr não chama expire novamente", async () => {
    await incrementQuotaOrReject("company-2", DEFAULT_DAILY_QUOTA);
    await incrementQuotaOrReject("company-2", DEFAULT_DAILY_QUOTA);
    // expire só chamado na primeira vez (count===1)
    expect(redisMock.expire).toHaveBeenCalledOnce();
  });

  it("abaixo do limite retorna over=false", async () => {
    const result = await incrementQuotaOrReject("company-3", 100);
    expect(result.over).toBe(false);
  });

  it("acima do limite retorna over=true", async () => {
    // Simula contador já em 101 chamando com limit=100
    // Força incr retornar valor acima do limite
    redisMock.incr.mockResolvedValueOnce(101);
    const result = await incrementQuotaOrReject("company-4", 100);
    expect(result.over).toBe(true);
    expect(result.count).toBe(101);
  });

  it("redis falha — degrade gracefully, retorna over=false", async () => {
    redisMock.incr.mockRejectedValueOnce(new Error("connection refused"));
    const result = await incrementQuotaOrReject("company-5", DEFAULT_DAILY_QUOTA);
    expect(result.over).toBe(false);
    expect(result.count).toBe(0);
  });
});
