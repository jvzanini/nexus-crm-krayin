/**
 * @vitest-environment jsdom
 *
 * Fase 5 — T13c: CustomFiltersSection (client) para FilterBar.
 * Spec v3 §3.10 + §3.6: renderiza filtros de custom attributes searchable:true
 * com operador (dropdown) + input de valor, colapsável, botão limpar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { CustomFiltersSection } from "./CustomFiltersSection";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

function makeDef(overrides: Partial<CustomAttribute>): CustomAttribute {
  return {
    id: "id-" + (overrides.key ?? "x"),
    tenantId: "t1",
    entity: "lead",
    key: "k",
    label: "L",
    type: "text",
    required: false,
    unique: false,
    searchable: true,
    sortable: false,
    piiMasked: false,
    status: "active",
    defaultValue: null,
    selectOptions: null,
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null,
    regex: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as unknown as CustomAttribute;
}

describe("CustomFiltersSection", () => {
  it("renderiza apenas defs com searchable: true", () => {
    const defs = [
      makeDef({ key: "score", label: "Score", type: "number", searchable: true }),
      makeDef({ key: "nope", label: "Nope", type: "text", searchable: false }),
    ];
    render(<CustomFiltersSection defs={defs} onApply={vi.fn()} />);
    // Abre o details para tornar inputs visíveis
    const details = screen.getByTestId("custom-filters-section");
    (details as HTMLDetailsElement).open = true;

    expect(screen.queryByText("Score")).not.toBeNull();
    expect(screen.queryByText("Nope")).toBeNull();
  });

  it("renderiza seção colapsável com título 'Atributos customizados'", () => {
    const defs = [makeDef({ key: "a", label: "A", type: "text" })];
    render(<CustomFiltersSection defs={defs} onApply={vi.fn()} />);
    const section = screen.getByTestId("custom-filters-section");
    expect(section.tagName.toLowerCase()).toBe("details");
    const summary = section.querySelector("summary");
    expect(summary?.textContent).toContain("Atributos customizados");
  });

  it("para cada def searchable renderiza operador (select) + input de valor", () => {
    const defs = [
      makeDef({ key: "city", label: "Cidade", type: "text" }),
      makeDef({ key: "score", label: "Score", type: "number" }),
    ];
    const { container } = render(
      <CustomFiltersSection defs={defs} onApply={vi.fn()} />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;

    expect(container.querySelector('[data-testid="op-city"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="val-city"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="op-score"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="val-score"]')).not.toBeNull();

    // operador de number inclui 'gt' (de OPS_BY_TYPE.number)
    const opScore = container.querySelector(
      '[data-testid="op-score"]',
    ) as HTMLSelectElement;
    const values = Array.from(opScore.options).map((o) => o.value);
    expect(values).toContain("gt");
    expect(values).toContain("eq");
  });

  it("onApply dispara com array {key, op, value} ao clicar Aplicar", () => {
    const defs = [makeDef({ key: "city", label: "Cidade", type: "text" })];
    const onApply = vi.fn();
    const { container } = render(
      <CustomFiltersSection defs={defs} onApply={onApply} />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;

    const input = container.querySelector(
      '[data-testid="val-city"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "SP" } });

    const applyBtn = screen.getByRole("button", { name: /aplicar/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([
      { key: "city", op: "eq", value: "SP" },
    ]);
  });

  it("botão Limpar reseta state e dispara onApply([])", () => {
    const defs = [makeDef({ key: "city", label: "Cidade", type: "text" })];
    const onApply = vi.fn();
    const { container } = render(
      <CustomFiltersSection
        defs={defs}
        initialFilters={[{ key: "city", op: "eq", value: "SP" }]}
        onApply={onApply}
      />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;

    const input = container.querySelector(
      '[data-testid="val-city"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("SP");

    const clearBtn = screen.getByRole("button", { name: /limpar/i });
    fireEvent.click(clearBtn);

    expect(input.value).toBe("");
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it("type=boolean usa select true/false como input de valor", () => {
    const defs = [makeDef({ key: "vip", label: "VIP", type: "boolean" })];
    const { container } = render(
      <CustomFiltersSection defs={defs} onApply={vi.fn()} />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;

    const val = container.querySelector(
      '[data-testid="val-vip"]',
    ) as HTMLSelectElement;
    expect(val.tagName.toLowerCase()).toBe("select");
    const values = Array.from(val.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["true", "false"]));
  });

  it("filtros com value vazio são ignorados ao aplicar", () => {
    const defs = [
      makeDef({ key: "city", label: "Cidade", type: "text" }),
      makeDef({ key: "score", label: "Score", type: "number" }),
    ];
    const onApply = vi.fn();
    const { container } = render(
      <CustomFiltersSection defs={defs} onApply={onApply} />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;

    const inputCity = container.querySelector(
      '[data-testid="val-city"]',
    ) as HTMLInputElement;
    fireEvent.change(inputCity, { target: { value: "SP" } });

    const applyBtn = screen.getByRole("button", { name: /aplicar/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith([
      { key: "city", op: "eq", value: "SP" },
    ]);
  });
});
