/**
 * Fase 5 — T13a: CustomFieldInput tests.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { CustomFieldInput } from "./CustomFieldInput";
import type { CustomAttribute } from "@/lib/custom-attributes/types";

function makeDef(overrides: Partial<CustomAttribute> = {}): CustomAttribute {
  return {
    id: "def-1",
    companyId: "c1",
    entity: "lead" as CustomAttribute["entity"],
    key: "cf_sample",
    label: "Sample",
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

describe("CustomFieldInput", () => {
  it("renderiza input text e dispara onChange com string", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldInput
        def={makeDef({ type: "text" as CustomAttribute["type"], label: "Nome" })}
        value=""
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("Nome") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("text");
    fireEvent.change(input, { target: { value: "João" } });
    expect(onChange).toHaveBeenCalledWith("João");
  });

  it("renderiza number input e dispara onChange com number", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldInput
        def={makeDef({ type: "number" as CustomAttribute["type"], label: "Idade" })}
        value={null}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("Idade") as HTMLInputElement;
    expect(input.type).toBe("number");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("renderiza date input type=date", () => {
    render(
      <CustomFieldInput
        def={makeDef({ type: "date" as CustomAttribute["type"], label: "Nasc" })}
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Nasc") as HTMLInputElement;
    expect(input.type).toBe("date");
  });

  it("renderiza datetime input type=datetime-local", () => {
    render(
      <CustomFieldInput
        def={makeDef({ type: "datetime" as CustomAttribute["type"], label: "Quando" })}
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Quando") as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
  });

  it("renderiza boolean como checkbox e dispara onChange com boolean", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldInput
        def={makeDef({ type: "boolean" as CustomAttribute["type"], label: "Ativo" })}
        value={false}
        onChange={onChange}
      />,
    );
    const cb = screen.getByRole("checkbox", { name: "Ativo" });
    expect(cb).toBeInTheDocument();
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(typeof lastCall).toBe("boolean");
  });

  it("renderiza select com options e dispara onChange com string", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldInput
        def={makeDef({
          type: "select" as CustomAttribute["type"],
          label: "Status",
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        })}
        value=""
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    const nativeSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    fireEvent.change(nativeSelect, { target: { value: "a" } });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("renderiza multi_select e dispara onChange com array", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldInput
        def={makeDef({
          type: "multi_select" as CustomAttribute["type"],
          label: "Tags",
          options: [
            { value: "x", label: "X" },
            { value: "y", label: "Y" },
          ],
        })}
        value={[]}
        onChange={onChange}
      />,
    );
    const x = screen.getByRole("checkbox", { name: "X" });
    fireEvent.click(x);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(Array.isArray(lastCall)).toBe(true);
    expect(lastCall).toContain("x");
  });

  it("renderiza url input type=url", () => {
    render(
      <CustomFieldInput
        def={makeDef({ type: "url" as CustomAttribute["type"], label: "Site" })}
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Site") as HTMLInputElement;
    expect(input.type).toBe("url");
  });

  it("required exibe asterisco visual", () => {
    render(
      <CustomFieldInput
        def={makeDef({ label: "Obrig", required: true })}
        value=""
        onChange={vi.fn()}
      />,
    );
    const label = screen.getByText(/Obrig/);
    expect(label.textContent).toMatch(/\*/);
  });

  it("error prop renderiza mensagem com aria-live e classe vermelha", () => {
    render(
      <CustomFieldInput
        def={makeDef({ label: "Campo" })}
        value=""
        onChange={vi.fn()}
        error="Inválido"
      />,
    );
    const msg = screen.getByText("Inválido");
    expect(msg).toBeInTheDocument();
    expect(msg).toHaveAttribute("aria-live", "polite");
    expect(msg.className).toMatch(/red|destructive/);
  });

  it("exibe placeholder e helpText", () => {
    render(
      <CustomFieldInput
        def={makeDef({
          label: "Campo",
          placeholder: "digite aqui",
          helpText: "texto de ajuda",
        })}
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Campo") as HTMLInputElement;
    expect(input.placeholder).toBe("digite aqui");
    expect(screen.getByText("texto de ajuda")).toBeInTheDocument();
  });
});
