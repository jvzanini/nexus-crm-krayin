import { describe, it, expect } from "vitest";
import { normalize } from "../normalize";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("MARIA")).toBe("maria");
  });
  it("removes diacritics", () => {
    expect(normalize("Ação")).toBe("acao");
    expect(normalize("café-crème")).toBe("cafe-creme");
  });
  it("trims", () => {
    expect(normalize("  João  ")).toBe("joao");
  });
  it("handles empty", () => {
    expect(normalize("")).toBe("");
  });
  it("keeps non-latin letters as-is (lowercased)", () => {
    expect(normalize("Ñuño")).toBe("nuno");
  });
});
