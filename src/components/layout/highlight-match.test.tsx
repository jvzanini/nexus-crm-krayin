/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HighlightMatch } from "./highlight-match";

describe("HighlightMatch", () => {
  it("wraps match in <mark>", () => {
    const { container } = render(<HighlightMatch text="Mariana Silva" query="maria" />);
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Maria");
  });

  it("preserves original case in match", () => {
    const { container } = render(<HighlightMatch text="JOÃO" query="joao" />);
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("JOÃO");
  });

  it("no match → plain text", () => {
    const { container } = render(<HighlightMatch text="Pedro" query="xyz" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("Pedro");
  });

  it("short query (<2) returns plain", () => {
    const { container } = render(<HighlightMatch text="Maria" query="m" />);
    expect(container.querySelector("mark")).toBeNull();
  });

  it("empty text returns null", () => {
    const { container } = render(<HighlightMatch text="" query="maria" />);
    expect(container.firstChild).toBeNull();
  });

  it("diacritic-insensitive match", () => {
    const { container } = render(<HighlightMatch text="Ação" query="acao" />);
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("Ação");
  });
});
