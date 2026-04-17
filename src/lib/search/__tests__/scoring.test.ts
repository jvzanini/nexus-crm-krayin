import { describe, it, expect } from "vitest";
import { scoreMatch, rankItems } from "../scoring";

describe("scoreMatch", () => {
  it("exact = 100", () => {
    expect(scoreMatch("Maria", "maria")).toBe(100);
  });
  it("startsWith = 75", () => {
    expect(scoreMatch("Mariana", "maria")).toBe(75);
  });
  it("contains = 50", () => {
    expect(scoreMatch("Ana Maria", "maria")).toBe(50);
  });
  it("no match = 0", () => {
    expect(scoreMatch("Pedro", "maria")).toBe(0);
  });
  it("null/undefined = 0", () => {
    expect(scoreMatch(null, "x")).toBe(0);
    expect(scoreMatch(undefined, "x")).toBe(0);
  });
  it("diacritic insensitive", () => {
    expect(scoreMatch("João", "joao")).toBe(100);
    expect(scoreMatch("Avião", "aviao")).toBe(100);
  });
  it("empty query = 0", () => {
    expect(scoreMatch("Maria", "")).toBe(0);
  });
});

describe("rankItems", () => {
  const items = [
    { title: "Ana Maria Pereira", subtitle: null },
    { title: "Mariana Silva", subtitle: null },
    { title: "Maria Santos", subtitle: null },
    { title: "Pedro Lima", subtitle: null },
  ];

  it("orders exact > startsWith > contains", () => {
    const result = rankItems(items, "maria");
    expect(result.map((r) => r.title)).toEqual([
      "Maria Santos",
      "Mariana Silva",
      "Ana Maria Pereira",
    ]);
  });

  it("tiebreaks alphabetically pt-BR", () => {
    const sameScore = [
      { title: "Zeca", subtitle: null },
      { title: "Álvaro", subtitle: null },
    ];
    const result = rankItems(sameScore, "a");
    expect(result.map((r) => r.title)).toEqual(["Álvaro", "Zeca"]);
  });

  it("respects limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ title: `Maria ${i}`, subtitle: null }));
    expect(rankItems(many, "maria", 3)).toHaveLength(3);
  });

  it("filters non-matches", () => {
    expect(rankItems(items, "xyz")).toHaveLength(0);
  });

  it("considers subtitle", () => {
    const withSub = [{ title: "X", subtitle: "maria@x.com" }];
    expect(rankItems(withSub, "maria")).toHaveLength(1);
  });
});
