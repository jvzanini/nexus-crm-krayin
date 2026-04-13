import { describe, it, expect } from "vitest";
import { validateCPF, validateCNPJ, validateCEP, formatCPF, formatCNPJ, formatCEP } from "./rules";

describe("validateCPF", () => {
  it.each([
    ["52998224725", true],
    ["529.982.247-25", true],
    ["11144477735", true],
    ["00000000000", false],
    ["11111111111", false],
    ["12345678900", false],
    ["1234567890", false],
    ["123456789012", false],
    ["", false],
  ])("validateCPF(%s) === %s", (input, expected) => {
    expect(validateCPF(input)).toBe(expected);
  });
});

describe("validateCNPJ", () => {
  it.each([
    ["11222333000181", true],
    ["11.222.333/0001-81", true],
    ["00000000000000", false],
    ["11222333000180", false],
    ["1122233300018", false],
    ["", false],
  ])("validateCNPJ(%s) === %s", (input, expected) => {
    expect(validateCNPJ(input)).toBe(expected);
  });
});

describe("validateCEP", () => {
  it.each([
    ["01310100", true],
    ["01310-100", true],
    ["1310100", false],
    ["013101000", false],
    ["", false],
  ])("validateCEP(%s) === %s", (input, expected) => {
    expect(validateCEP(input)).toBe(expected);
  });
});

describe("formatCPF", () => {
  it("formats 11 digits", () => { expect(formatCPF("52998224725")).toBe("529.982.247-25"); });
  it("passes through on partial input", () => { expect(formatCPF("123")).toBe("123"); });
  it("is idempotent", () => { expect(formatCPF("529.982.247-25")).toBe("529.982.247-25"); });
});

describe("formatCNPJ", () => {
  it("formats 14 digits", () => { expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81"); });
  it("passes through on partial", () => { expect(formatCNPJ("1122")).toBe("1122"); });
});

describe("formatCEP", () => {
  it("formats 8 digits", () => { expect(formatCEP("01310100")).toBe("01310-100"); });
  it("passes through on partial", () => { expect(formatCEP("013")).toBe("013"); });
});
