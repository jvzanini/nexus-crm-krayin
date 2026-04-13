import { describe, it, expect } from "vitest";
import { validatePhoneBR, formatPhoneBR, maskPhoneBR } from "./phone";

describe("validatePhoneBR", () => {
  it.each([
    ["+5511987654321", true],
    ["+5521987654321", true],
    ["5511987654321", true],
    ["11987654321", true],
    ["", false],
    ["abc", false],
  ])("validatePhoneBR(%s) === %s", (input, expected) => {
    expect(validatePhoneBR(input)).toBe(expected);
  });
});

describe("formatPhoneBR", () => {
  it("formats E.164 BR number to national", () => {
    expect(formatPhoneBR("+5511987654321")).toMatch(/\(11\)\s*98765-4321/);
  });
  it("passes through invalid input", () => {
    expect(formatPhoneBR("abc")).toBe("abc");
  });
});

describe("maskPhoneBR", () => {
  it("masks progressively", () => {
    expect(maskPhoneBR("11")).toMatch(/11/);
    expect(maskPhoneBR("11987")).toMatch(/\(11\)/);
  });
});
