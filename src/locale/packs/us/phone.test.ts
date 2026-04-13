import { describe, it, expect } from "vitest";
import { validatePhoneUS, formatPhoneUS } from "./phone";

describe("validatePhoneUS", () => {
  it.each([
    ["+14155551234", true],
    ["4155551234", true],
    ["415-555-1234", true],
    ["", false],
    ["abc", false],
  ])("validatePhoneUS(%s) === %s", (input, expected) => {
    expect(validatePhoneUS(input)).toBe(expected);
  });
});

describe("formatPhoneUS", () => {
  it("formats E.164 to national", () => {
    expect(formatPhoneUS("+14155551234")).toMatch(/\(415\)\s*555-1234/);
  });
});
