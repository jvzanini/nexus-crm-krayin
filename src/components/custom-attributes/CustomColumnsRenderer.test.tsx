/**
 * Fase 5 — T13b/34: CustomColumnsRenderer (client).
 *
 * Renderiza células de custom attributes em tabelas (linha por defs.visibleInList).
 * Formatação por tipo conforme spec v3 §3.10.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CustomAttribute } from "@/lib/custom-attributes/types";
import { CustomColumnsRenderer } from "./CustomColumnsRenderer";

/**
 * Helper: cria definição parcial válida com defaults sensatos.
 */
function def(overrides: Partial<CustomAttribute>): CustomAttribute {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    companyId: "00000000-0000-0000-0000-000000000000",
    entity: "lead",
    key: "field",
    label: "Field",
    type: "text",
    required: false,
    isUnique: false,
    options: null,
    defaultValue: null,
    placeholder: null,
    helpText: null,
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null,
    position: 0,
    visibleInList: true,
    searchable: false,
    sortable: false,
    piiMasked: false,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as CustomAttribute;
}

describe("CustomColumnsRenderer", () => {
  it("só renderiza defs com visibleInList=true", () => {
    const defs = [
      def({ key: "visible", label: "Visible", type: "text", visibleInList: true }),
      def({ key: "hidden", label: "Hidden", type: "text", visibleInList: false }),
    ];
    const values = { visible: "abc", hidden: "xyz" };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={values} />
          </tr>
        </tbody>
      </table>,
    );
    expect(container.textContent).toContain("abc");
    expect(container.textContent).not.toContain("xyz");
  });

  it("text/url → texto formatado com truncate em 40 chars + ellipsis", () => {
    const longText = "a".repeat(60);
    const longUrl = "https://example.com/" + "b".repeat(60);
    const defs = [
      def({ key: "t", type: "text" }),
      def({ key: "u", type: "url" }),
    ];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ t: longText, u: longUrl }} />
          </tr>
        </tbody>
      </table>,
    );
    // Trunca em 40 chars + ellipsis ("…") → tamanho 41.
    const textCell = container.querySelector('[data-key="t"]');
    const urlCell = container.querySelector('[data-key="u"]');
    expect(textCell?.textContent).toBe("a".repeat(40) + "…");
    expect(urlCell?.textContent?.endsWith("…")).toBe(true);
    expect(urlCell?.textContent?.length).toBe(41);
  });

  it("number → formatado com Intl.NumberFormat pt-BR", () => {
    const defs = [def({ key: "n", type: "number" })];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ n: 1234567.89 }} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-key="n"]');
    // pt-BR usa "." para milhar e "," para decimal.
    expect(cell?.textContent).toBe(
      new Intl.NumberFormat("pt-BR").format(1234567.89),
    );
  });

  it("date → Intl.DateTimeFormat pt-BR (formato YYYY-MM-DD apenas)", () => {
    const defs = [def({ key: "d", type: "date" })];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ d: "2026-04-15" }} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-key="d"]');
    // Pt-BR default dd/mm/aaaa → "15/04/2026".
    expect(cell?.textContent).toBe("15/04/2026");
  });

  it("datetime → formato tz-aware; se parse falhar render ISO original", () => {
    const defs = [
      def({ key: "dt", type: "datetime" }),
      def({ key: "bad", type: "datetime" }),
    ];
    const iso = "2026-04-15T10:30:00Z";
    const bad = "not-a-date";
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer
              defs={defs}
              customValues={{ dt: iso, bad }}
            />
          </tr>
        </tbody>
      </table>,
    );
    const okCell = container.querySelector('[data-key="dt"]');
    const badCell = container.querySelector('[data-key="bad"]');
    // Deve conter dia/mês/ano pt-BR. Evita flakiness de timezone checando só o padrão.
    expect(okCell?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    // Parse falha → render ISO original.
    expect(badCell?.textContent).toBe(bad);
  });

  it("boolean → badge verde para true, vermelho para false", () => {
    const defs = [
      def({ key: "yes", type: "boolean" }),
      def({ key: "no", type: "boolean" }),
    ];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ yes: true, no: false }} />
          </tr>
        </tbody>
      </table>,
    );
    const yesCell = container.querySelector('[data-key="yes"]');
    const noCell = container.querySelector('[data-key="no"]');
    expect(yesCell?.querySelector('[data-bool="true"]')).not.toBeNull();
    expect(noCell?.querySelector('[data-bool="false"]')).not.toBeNull();
  });

  it("multi_select → pills via Badge do DS", () => {
    const defs = [
      def({
        key: "tags",
        type: "multi_select",
        options: [
          { value: "a", label: "Alpha" },
          { value: "b", label: "Bravo" },
          { value: "c", label: "Charlie" },
        ],
      }),
    ];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ tags: ["a", "c"] }} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-key="tags"]');
    const pills = cell?.querySelectorAll('[data-slot="badge"], [data-pill]');
    expect(pills && pills.length).toBe(2);
    expect(cell?.textContent).toContain("Alpha");
    expect(cell?.textContent).toContain("Charlie");
    expect(cell?.textContent).not.toContain("Bravo");
  });

  it("select → texto do label via lookup em def.options", () => {
    const defs = [
      def({
        key: "status",
        type: "select",
        options: [
          { value: "open", label: "Aberto" },
          { value: "closed", label: "Fechado" },
        ],
      }),
    ];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ status: "closed" }} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-key="status"]');
    expect(cell?.textContent).toBe("Fechado");
  });

  it("null/undefined value → dash (—)", () => {
    const defs = [
      def({ key: "a", type: "text" }),
      def({ key: "b", type: "number" }),
    ];
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <CustomColumnsRenderer defs={defs} customValues={{ a: null }} />
          </tr>
        </tbody>
      </table>,
    );
    expect(container.querySelector('[data-key="a"]')?.textContent).toBe("—");
    expect(container.querySelector('[data-key="b"]')?.textContent).toBe("—");
  });
});
