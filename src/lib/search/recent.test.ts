/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getRecents, addRecent, clearRecents } from "./recent";

beforeEach(() => {
  window.localStorage.clear();
});

describe("recent searches", () => {
  it("add then get", () => {
    addRecent("maria");
    const recents = getRecents();
    expect(recents).toHaveLength(1);
    expect(recents[0].q).toBe("maria");
  });

  it("dedupes and moves to top", () => {
    addRecent("ana");
    addRecent("maria");
    addRecent("ana");
    const recents = getRecents();
    expect(recents.map((r) => r.q)).toEqual(["ana", "maria"]);
  });

  it("keeps only 5", () => {
    ["aa", "bb", "cc", "dd", "ee", "ff", "gg"].forEach((q) => addRecent(q));
    const recents = getRecents();
    expect(recents).toHaveLength(5);
    expect(recents[0].q).toBe("gg");
  });

  it("drops expired", () => {
    const stale = {
      version: 1,
      queries: [
        { q: "old", ts: Date.now() - 31 * 24 * 60 * 60 * 1000 },
        { q: "fresh", ts: Date.now() },
      ],
    };
    window.localStorage.setItem("nexus_crm_recent_searches_v1", JSON.stringify(stale));
    const recents = getRecents();
    expect(recents.map((r) => r.q)).toEqual(["fresh"]);
  });

  it("clear empties", () => {
    addRecent("maria");
    clearRecents();
    expect(getRecents()).toEqual([]);
  });

  it("ignores short queries", () => {
    addRecent("");
    addRecent("a");
    expect(getRecents()).toEqual([]);
  });

  it("handles corrupted JSON", () => {
    window.localStorage.setItem("nexus_crm_recent_searches_v1", "{not valid}");
    expect(getRecents()).toEqual([]);
  });

  it("handles wrong shape", () => {
    window.localStorage.setItem(
      "nexus_crm_recent_searches_v1",
      JSON.stringify({ version: 2, queries: [] }),
    );
    expect(getRecents()).toEqual([]);
  });
});
