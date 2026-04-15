/**
 * @vitest-environment jsdom
 *
 * Fase 5 — T18: FilterBar aceita `customFilters` prop opcional que, se
 * fornecida, renderiza a `CustomFiltersSection` (T13c) abaixo dos filtros
 * nativos. Compatibilidade backward mandatória: sem a prop, comportamento
 * permanece inalterado.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

// Fase 33 — saved-filters server action tem "use server" + next-auth import
// indireto. Para manter este teste puramente client-side, stub do menu
// renderiza nada (não é alvo deste spec).
vi.mock("./saved-filters-menu", () => ({
  SavedFiltersMenu: () => null,
}));

import { FilterBar, type FilterConfig } from "./filter-bar";
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
    helpText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CustomAttribute;
}

const nativeFilters: FilterConfig[] = [
  {
    type: "input",
    key: "q",
    label: "Busca",
    placeholder: "Buscar…",
    value: "",
  },
];

describe("FilterBar", () => {
  it("sem customFilters prop é compatível backward (não renderiza seção custom)", () => {
    render(
      <FilterBar
        filters={nativeFilters}
        onChange={() => {}}
        onClear={() => {}}
        hasActive={false}
      />,
    );

    expect(screen.queryByTestId("custom-filters-section")).toBeNull();
    // filtro nativo renderizado
    expect(screen.getByPlaceholderText("Buscar…")).toBeTruthy();
  });

  it("com customFilters.defs preenchido renderiza CustomFiltersSection", () => {
    const defs = [
      makeDef({ key: "plano", label: "Plano", type: "text", searchable: true }),
    ];
    render(
      <FilterBar
        filters={nativeFilters}
        onChange={() => {}}
        onClear={() => {}}
        hasActive={false}
        customFilters={{ defs, onApply: () => {} }}
      />,
    );

    expect(screen.getByTestId("custom-filters-section")).toBeTruthy();
    expect(screen.getByText("Plano")).toBeTruthy();
  });

  it("encaminha onApply do CustomFiltersSection com filters construídos", () => {
    const defs = [
      makeDef({ key: "plano", label: "Plano", type: "text", searchable: true }),
    ];
    const onApply = vi.fn();
    render(
      <FilterBar
        filters={nativeFilters}
        onChange={() => {}}
        onClear={() => {}}
        hasActive={false}
        customFilters={{ defs, onApply }}
      />,
    );

    const input = screen.getByTestId("val-plano") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "gold" } });
    fireEvent.click(screen.getByText("Aplicar"));

    expect(onApply).toHaveBeenCalledTimes(1);
    const call = onApply.mock.calls[0][0];
    expect(Array.isArray(call)).toBe(true);
    expect(call[0]).toMatchObject({ key: "plano", value: "gold" });
  });

  it("com customFilters.defs vazio não renderiza seção", () => {
    render(
      <FilterBar
        filters={nativeFilters}
        onChange={() => {}}
        onClear={() => {}}
        hasActive={false}
        customFilters={{ defs: [], onApply: () => {} }}
      />,
    );
    expect(screen.queryByTestId("custom-filters-section")).toBeNull();
  });
});
