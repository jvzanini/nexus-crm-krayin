const KEY = "nexus_crm_recent_searches_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LIMIT = 5;

export interface RecentEntry {
  q: string;
  ts: number;
}

interface StoredShape {
  version: 1;
  queries: RecentEntry[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRecents(): RecentEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredShape;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.queries)) return [];
    const now = Date.now();
    return parsed.queries
      .filter((e) => e && typeof e.q === "string" && typeof e.ts === "number" && now - e.ts < TTL_MS)
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function addRecent(q: string): void {
  if (!isBrowser()) return;
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    const existing = getRecents().filter((e) => e.q !== trimmed);
    const next: RecentEntry[] = [{ q: trimmed, ts: Date.now() }, ...existing].slice(0, LIMIT);
    const payload: StoredShape = { version: 1, queries: next };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearRecents(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
