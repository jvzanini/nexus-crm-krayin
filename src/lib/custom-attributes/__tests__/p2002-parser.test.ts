import { describe, it, expect } from "vitest";
import { parseP2002IndexName } from "../p2002-parser";

describe("parseP2002IndexName", () => {
  it("parses idx_leads_custom_cpf_unique", () => {
    const err = { code: "P2002", meta: { target: "idx_leads_custom_cpf_unique" } };
    expect(parseP2002IndexName(err)).toEqual({ entity: "lead", key: "cpf" });
  });

  it("parses idx_contacts_custom_email_secundario_unique", () => {
    const err = {
      code: "P2002",
      meta: { target: "idx_contacts_custom_email_secundario_unique" },
    };
    expect(parseP2002IndexName(err)).toEqual({
      entity: "contact",
      key: "email_secundario",
    });
  });

  it("parses idx_opportunities_custom_mrr_unique", () => {
    const err = {
      code: "P2002",
      meta: { target: "idx_opportunities_custom_mrr_unique" },
    };
    expect(parseP2002IndexName(err)).toEqual({
      entity: "opportunity",
      key: "mrr",
    });
  });

  it("parses truncated index name with hash suffix", () => {
    const err = {
      code: "P2002",
      meta: {
        target:
          "idx_leads_custom_chave_muito_longa_de_atributo_personalizado_a1b2c3",
      },
    };
    expect(parseP2002IndexName(err)).toEqual({
      entity: "lead",
      key: "chave_muito_longa_de_atributo_personalizado",
    });
  });

  it("returns null when meta.target is empty", () => {
    const err = { code: "P2002", meta: { target: [] } };
    expect(parseP2002IndexName(err)).toBeNull();
  });

  it("returns null when code is not P2002", () => {
    const err = { code: "P2003", meta: { target: "idx_leads_custom_cpf_unique" } };
    expect(parseP2002IndexName(err)).toBeNull();
  });

  it("accepts array target (Prisma may pass array)", () => {
    const err = {
      code: "P2002",
      meta: { target: ["idx_leads_custom_cpf_unique"] },
    };
    expect(parseP2002IndexName(err)).toEqual({ entity: "lead", key: "cpf" });
  });

  it("returns null for non-matching index name", () => {
    const err = { code: "P2002", meta: { target: "some_other_index" } };
    expect(parseP2002IndexName(err)).toBeNull();
  });

  it("returns null when err is null/undefined", () => {
    expect(parseP2002IndexName(null)).toBeNull();
    expect(parseP2002IndexName(undefined)).toBeNull();
  });
});
