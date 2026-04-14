import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { configureRateLimit, resetRateLimit } from "@nexusai360/core";

// Fake Redis stub mínimo que cobre os métodos usados pelo core:
// multi/pttl/get/incr/pexpire/exec/set/del
function makeFakeRedis() {
  const store = new Map<string, { value: string; expireAt?: number }>();
  const now = () => Date.now();
  const isExpired = (e: { expireAt?: number }) =>
    e.expireAt !== undefined && e.expireAt <= now();
  const get = (k: string) => {
    const e = store.get(k);
    if (!e || isExpired(e)) {
      store.delete(k);
      return null;
    }
    return e.value;
  };
  const pttl = (k: string) => {
    const e = store.get(k);
    if (!e) return -2;
    if (e.expireAt === undefined) return -1;
    const ms = e.expireAt - now();
    return ms > 0 ? ms : -2;
  };
  const incr = (k: string) => {
    const cur = Number(get(k) ?? "0") + 1;
    const prev = store.get(k);
    store.set(k, { value: String(cur), expireAt: prev?.expireAt });
    return cur;
  };
  const pexpire = (k: string, ms: number) => {
    const e = store.get(k);
    if (!e) return 0;
    store.set(k, { value: e.value, expireAt: now() + ms });
    return 1;
  };
  const set = (k: string, v: string, _opt: string, ttlSec: number) => {
    store.set(k, { value: v, expireAt: now() + ttlSec * 1000 });
    return "OK";
  };
  const del = (...keys: string[]) => {
    let n = 0;
    for (const k of keys) if (store.delete(k)) n++;
    return n;
  };
  function multi() {
    const ops: Array<() => unknown> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      pttl: (k: string) => {
        ops.push(() => pttl(k));
        return chain;
      },
      get: (k: string) => {
        ops.push(() => get(k));
        return chain;
      },
      incr: (k: string) => {
        ops.push(() => incr(k));
        return chain;
      },
      pexpire: (k: string, ms: number) => {
        ops.push(() => pexpire(k, ms));
        return chain;
      },
      exec: async () => ops.map((op) => [null, op()]),
    };
    return chain;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { multi, set, del, _store: store } as any;
}

describe("checkLoginRateLimit (wrapper de @nexusai360/core)", () => {
  let fakeRedis: ReturnType<typeof makeFakeRedis>;
  let mod: typeof import("../rate-limit");

  beforeEach(async () => {
    fakeRedis = makeFakeRedis();
    configureRateLimit(fakeRedis);
    vi.resetModules();
    mod = await import("../rate-limit");
  });

  afterEach(() => {
    resetRateLimit();
  });

  it("permite 4 primeiras tentativas, bloqueia na 5ª com retryAfter=900", async () => {
    for (let i = 1; i <= 4; i++) {
      const r = await mod.checkLoginRateLimit("u@x.com", "1.1.1.1");
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(5 - i);
    }
    const r5 = await mod.checkLoginRateLimit("u@x.com", "1.1.1.1");
    expect(r5.allowed).toBe(false);
    expect(r5.retryAfterSeconds).toBe(15 * 60);
  });

  it("bloqueia imediatamente se lockout ativo", async () => {
    fakeRedis.set("lockout:u@x.com:2.2.2.2", "1", "EX", 600);
    const r = await mod.checkLoginRateLimit("u@x.com", "2.2.2.2");
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it("clearLoginRateLimit deleta ambas as chaves", async () => {
    await mod.checkLoginRateLimit("u@x.com", "3.3.3.3");
    expect(fakeRedis._store.has("u@x.com:3.3.3.3")).toBe(true);
    await mod.clearLoginRateLimit("u@x.com", "3.3.3.3");
    expect(fakeRedis._store.has("u@x.com:3.3.3.3")).toBe(false);
    expect(fakeRedis._store.has("lockout:u@x.com:3.3.3.3")).toBe(false);
  });
});
