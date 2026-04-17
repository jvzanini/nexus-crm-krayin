import { describe, expect, it } from "vitest";
import {
  assertCustomBytes,
  assertKeyNotReserved,
  CustomAttrBytesExceededError,
  CustomAttrReservedKeyError,
  MAX_CUSTOM_BYTES_PER_ROW,
  RESERVED_KEYS,
} from "../limits";

describe("custom-attributes/limits", () => {
  it("assertCustomBytes aceita payload pequeno", () => {
    expect(() => assertCustomBytes({ name: "ok" })).not.toThrow();
    expect(() => assertCustomBytes({})).not.toThrow();
    expect(() => assertCustomBytes(null)).not.toThrow();
  });

  it("assertCustomBytes lança quando excede 32KB", () => {
    // "a".repeat(33000) encode JSON ~33002 bytes > 32KB.
    const huge = { payload: "a".repeat(33000) };
    expect(() => assertCustomBytes(huge)).toThrow(CustomAttrBytesExceededError);
  });

  it("assertCustomBytes é exatamente no limite (passa)", () => {
    // Construir payload de exatamente MAX_CUSTOM_BYTES_PER_ROW bytes.
    const base = { k: "" };
    const overhead = JSON.stringify(base).length;
    const fillLen = MAX_CUSTOM_BYTES_PER_ROW - overhead;
    const payload = { k: "a".repeat(fillLen) };
    expect(() => assertCustomBytes(payload)).not.toThrow();
  });

  it("assertKeyNotReserved rejeita keys reservadas (case-insensitive)", () => {
    for (const reserved of RESERVED_KEYS) {
      expect(() => assertKeyNotReserved(reserved)).toThrow(
        CustomAttrReservedKeyError,
      );
    }
    // Case-insensitive
    expect(() => assertKeyNotReserved("ID")).toThrow(CustomAttrReservedKeyError);
    expect(() => assertKeyNotReserved("Email")).toThrow(
      CustomAttrReservedKeyError,
    );
  });

  it("assertKeyNotReserved aceita keys válidas", () => {
    expect(() => assertKeyNotReserved("cpf")).not.toThrow();
    expect(() => assertKeyNotReserved("mrr")).not.toThrow();
    expect(() => assertKeyNotReserved("custom_field_1")).not.toThrow();
  });
});
