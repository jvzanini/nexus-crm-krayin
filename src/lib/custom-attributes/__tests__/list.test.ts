/**
 * Fase 5 — Custom Attributes: list cached tests (T7/34).
 * Spec v3 §3.7 — `unstable_cache` + `revalidateTag` por tenant+entity.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customAttribute: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

// Simula `unstable_cache` com cache em memória por chave + tag invalidation,
// permitindo validar hit/miss e revalidateTag sem depender do Next runtime.
type CacheEntry = { value: unknown; tags: string[] };
const cacheStore = new Map<string, CacheEntry>();

function resetCacheStore() {
  cacheStore.clear();
}

vi.mock("next/cache", () => {
  return {
    unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(
      fn: T,
      keyParts: string[],
      opts: { tags?: string[] } = {},
    ) => {
      return async (...args: Parameters<T>) => {
        const key = JSON.stringify(keyParts);
        const hit = cacheStore.get(key);
        if (hit) return hit.value;
        const value = await fn(...args);
        cacheStore.set(key, { value, tags: opts.tags ?? [] });
        return value;
      };
    },
    revalidateTag: (tag: string, _profile?: string | { expire?: number }) => {
      for (const [k, entry] of cacheStore.entries()) {
        if (entry.tags.includes(tag)) cacheStore.delete(k);
      }
    },
  };
});

// Import after vi.mock
import {
  listCustomAttributes,
  invalidateCustomAttrsCache,
} from "./list";

describe("listCustomAttributes (T7 cached)", () => {
  beforeEach(() => {
    findMany.mockReset();
    resetCacheStore();
  });

  it("cache miss on first call and hit on second call (no extra DB call)", async () => {
    findMany.mockResolvedValue([{ id: "a1", key: "foo" }]);

    const first = await listCustomAttributes("company-1", "lead");
    const second = await listCustomAttributes("company-1", "lead");

    expect(first).toEqual([{ id: "a1", key: "foo" }]);
    expect(second).toEqual([{ id: "a1", key: "foo" }]);
    expect(findMany).toHaveBeenCalledTimes(1);
    // Confirma filtro por status active (soft-delete via "deleting").
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: "company-1", entity: "lead", status: "active" },
      orderBy: { position: "asc" },
    });
  });

  it("revalidateTag via invalidateCustomAttrsCache forces next call to hit DB", async () => {
    findMany.mockResolvedValueOnce([{ id: "a1" }]);
    findMany.mockResolvedValueOnce([{ id: "a1" }, { id: "a2" }]);

    await listCustomAttributes("company-1", "lead");
    invalidateCustomAttrsCache("company-1", "lead");
    const after = await listCustomAttributes("company-1", "lead");

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(after).toHaveLength(2);
  });

  it("cross-tenant isolation — tenants A and B have independent caches/results", async () => {
    findMany.mockImplementation(
      async ({ where }: { where: { companyId: string } }) => [
        { id: `row-${where.companyId}`, companyId: where.companyId },
      ],
    );

    const a = await listCustomAttributes("company-A", "lead");
    const b = await listCustomAttributes("company-B", "lead");
    const aAgain = await listCustomAttributes("company-A", "lead");

    expect(a).toEqual([{ id: "row-company-A", companyId: "company-A" }]);
    expect(b).toEqual([{ id: "row-company-B", companyId: "company-B" }]);
    expect(aAgain).toEqual(a);
    // 2 misses (A e B) + 1 hit (A again) = 2 DB calls
    expect(findMany).toHaveBeenCalledTimes(2);

    // Invalidar tenant A não afeta cache do tenant B.
    findMany.mockClear();
    invalidateCustomAttrsCache("company-A", "lead");
    await listCustomAttributes("company-A", "lead"); // miss
    await listCustomAttributes("company-B", "lead"); // hit
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
