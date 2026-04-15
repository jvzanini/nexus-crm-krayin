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

  it("multiple matches highlighted (C4/I6)", () => {
    const { container } = render(
      <HighlightMatch text="Maria e Mariana" query="mari" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0]?.textContent).toBe("Mari");
    expect(marks[1]?.textContent).toBe("Mari");
  });

  it("NFD-decomposed source text offsets preserved (C4)", () => {
    // "São" em forma NFD: S + a + \u0303 + o (4 code units)
    const nfd = "Sa\u0303o Paulo".normalize("NFD");
    const { container } = render(<HighlightMatch text={nfd} query="sao" />);
    const mark = container.querySelector("mark");
    // Deve destacar os 4 code units originais (S + a + combining + o), não
    // 3 como seria no modo ingênuo de `text.slice(normalizedIdx, ...)`.
    expect(mark?.textContent).toBe("Sa\u0303o");
  });

  it("no XSS via query with script tag (safe as text)", () => {
    const { container } = render(
      <HighlightMatch text="Hello <script>alert(1)</script>" query="script" />,
    );
    // O <script> é texto literal (React escapa), nenhum script real deve aparecer.
    expect(container.querySelector("script")).toBeNull();
  });
});
