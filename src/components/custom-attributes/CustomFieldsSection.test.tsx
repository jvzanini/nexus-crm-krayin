/**
 * Fase 5 — T13a: CustomFieldsSection tests.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { CustomFieldsSection } from "./CustomFieldsSection";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

function makeDef(overrides: Partial<CustomAttribute> = {}): CustomAttribute {
  return {
    id: "d",
    companyId: "c1",
    entity: "lead" as CustomAttribute["entity"],
    key: "cf_x",
    label: "X",
    type: "text" as CustomAttribute["type"],
    required: false,
    isUnique: false,
    options: [],
    defaultValue: null,
    placeholder: null,
    helpText: null,
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null,
    position: 0,
    visibleInList: false,
    searchable: false,
    sortable: false,
    piiMasked: false,
    status: "active" as CustomAttribute["status"],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CustomAttribute;
}

describe("CustomFieldsSection", () => {
  it("renderiza defs ordenados por position", () => {
    const defs = [
      makeDef({ id: "2", key: "cf_b", label: "Beta", position: 2 }),
      makeDef({ id: "1", key: "cf_a", label: "Alpha", position: 0 }),
      makeDef({ id: "3", key: "cf_c", label: "Gamma", position: 1 }),
    ];
    render(<CustomFieldsSection defs={defs} values={{}} onChange={vi.fn()} />);
    const labels = screen.getAllByText(/Alpha|Beta|Gamma/);
    const textOrder = labels.map((el) => el.textContent);
    const alphaIdx = textOrder.findIndex((t) => t?.includes("Alpha"));
    const gammaIdx = textOrder.findIndex((t) => t?.includes("Gamma"));
    const betaIdx = textOrder.findIndex((t) => t?.includes("Beta"));
    expect(alphaIdx).toBeLessThan(gammaIdx);
    expect(gammaIdx).toBeLessThan(betaIdx);
  });

  it("valores iniciais preenchem inputs", () => {
    const defs = [
      makeDef({ key: "cf_nome", label: "Nome" }),
    ];
    render(
      <CustomFieldsSection
        defs={defs}
        values={{ cf_nome: "Maria" }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Nome") as HTMLInputElement;
    expect(input.value).toBe("Maria");
  });

  it("onChange agrega mudanças no objeto custom preservando outros campos", () => {
    const onChange = vi.fn();
    const defs = [
      makeDef({ id: "1", key: "cf_a", label: "A", position: 0 }),
      makeDef({ id: "2", key: "cf_b", label: "B", position: 1 }),
    ];
    render(
      <CustomFieldsSection
        defs={defs}
        values={{ cf_a: "valA", cf_b: "valB" }}
        onChange={onChange}
      />,
    );
    const inputA = screen.getByLabelText("A") as HTMLInputElement;
    fireEvent.change(inputA, { target: { value: "novo" } });
    expect(onChange).toHaveBeenCalledWith({ cf_a: "novo", cf_b: "valB" });
  });
});
