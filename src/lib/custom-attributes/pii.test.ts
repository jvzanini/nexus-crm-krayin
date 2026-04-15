/**
 * Fase 5 — Custom Attributes: util de PII redact (T19/34).
 *
 * Spec v3 §3.9 — `stripPii(custom, defs)` aplica "***REDACTED***"
 * apenas em keys marcadas `piiMasked=true`. `getPiiKeys(defs)` lista
 * essas keys (para Pino redact paths).
 */
import { describe, it, expect } from "vitest";

import { REDACTED_MARKER, getPiiKeys, stripPii } from "./pii";

type DefLike = { key: string; piiMasked: boolean };

describe("stripPii", () => {
  it("redige apenas keys piiMasked=true, preserva non-PII", () => {
    const defs: DefLike[] = [
      { key: "cpf", piiMasked: true },
      { key: "mrr", piiMasked: false },
    ];
    const out = stripPii({ cpf: "123", mrr: 1000 }, defs as any);
    expect(out).toEqual({ cpf: REDACTED_MARKER, mrr: 1000 });
  });

  it("defs vazio retorna custom intacto", () => {
    const out = stripPii({ a: 1, b: "x" }, [] as any);
    expect(out).toEqual({ a: 1, b: "x" });
  });

  it("key presente no custom mas ausente nas defs é preservada (unknown → not masked)", () => {
    const defs: DefLike[] = [{ key: "cpf", piiMasked: true }];
    const out = stripPii({ extra: "keep-me" }, defs as any);
    expect(out).toEqual({ extra: "keep-me" });
  });

  it("custom nulo/indefinido retorna objeto vazio", () => {
    expect(stripPii(null, [] as any)).toEqual({});
    expect(stripPii(undefined, [] as any)).toEqual({});
  });

  it("não muta o input original", () => {
    const defs: DefLike[] = [{ key: "cpf", piiMasked: true }];
    const input = { cpf: "123", mrr: 1000 };
    const out = stripPii(input, defs as any);
    expect(input).toEqual({ cpf: "123", mrr: 1000 });
    expect(out).not.toBe(input);
  });
});

describe("getPiiKeys", () => {
  it("retorna apenas keys piiMasked=true", () => {
    const defs: DefLike[] = [
      { key: "cpf", piiMasked: true },
      { key: "mrr", piiMasked: false },
      { key: "passport", piiMasked: true },
    ];
    expect(getPiiKeys(defs as any)).toEqual(["cpf", "passport"]);
  });

  it("defs vazio retorna array vazio", () => {
    expect(getPiiKeys([] as any)).toEqual([]);
  });
});
