import { describe, it, expect } from "vitest";
import { validateSSN, validateEIN, validateZIP, formatSSN, formatEIN, formatZIP } from "./rules";

describe("validateSSN", () => {
  it.each([
    ["123456789", true],
    ["123-45-6789", true],
    ["000000000", false],
    ["666123456", false],
    ["12345678", false],
    ["1234567890", false],
    ["", false],
  ])("validateSSN(%s) === %s", (input, expected) => {
    expect(validateSSN(input)).toBe(expected);
  });
});

describe("validateEIN", () => {
  it.each([
    ["123456789", true],
    ["12-3456789", true],
    ["12345678", false],
    ["", false],
  ])("validateEIN(%s) === %s", (input, expected) => {
    expect(validateEIN(input)).toBe(expected);
  });
});

describe("validateZIP", () => {
  it.each([
    ["94105", true],
    ["941051234", true],
    ["94105-1234", true],
    ["9410", false],
    ["", false],
  ])("validateZIP(%s) === %s", (input, expected) => {
    expect(validateZIP(input)).toBe(expected);
  });
});

describe("formatSSN", () => {
  it("formats 9 digits", () => { expect(formatSSN("123456789")).toBe("123-45-6789"); });
  it("passes through on partial", () => { expect(formatSSN("123")).toBe("123"); });
});

describe("formatEIN", () => {
  it("formats 9 digits", () => { expect(formatEIN("123456789")).toBe("12-3456789"); });
});

describe("formatZIP", () => {
  it("formats 5 digits unchanged", () => { expect(formatZIP("94105")).toBe("94105"); });
  it("formats ZIP+4", () => { expect(formatZIP("941051234")).toBe("94105-1234"); });
});
