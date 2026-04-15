"use client";

/**
 * Fase 5 T14/34 — dialog de criação/edição de Custom Attribute.
 *
 * Em `edit`: campos `key` e `type` ficam disabled (imutáveis — spec v3 §3.8).
 * Em `select`/`multi_select`: exibe editor de opções (array {value,label}).
 *
 * Submit routeia para server action `createCustomAttribute` ou
 * `updateCustomAttribute` e exibe erros inline abaixo do form.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "@nexusai360/design-system";
import { toast } from "sonner";
import {
  createCustomAttribute,
  updateCustomAttribute,
  type CreateCustomAttributeInput,
  type UpdateCustomAttributeInput,
} from "@/lib/actions/custom-attributes";
import type {
  CustomAttribute,
  CustomAttributeEntity,
} from "@/lib/custom-attributes/types";

type Mode = "create" | "edit";

type AttrType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multi_select"
  | "url";

const TYPE_OPTIONS: AttrType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "multi_select",
  "url",
];

interface Props {
  mode: Mode;
  entity: CustomAttributeEntity;
  target?: CustomAttribute;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

interface FormState {
  label: string;
  key: string;
  type: AttrType;
  required: boolean;
  isUnique: boolean;
  visibleInList: boolean;
  searchable: boolean;
  sortable: boolean;
  piiMasked: boolean;
  position: number;
  placeholder: string;
  helpText: string;
  minLength: string;
  maxLength: string;
  minValue: string;
  maxValue: string;
  options: { value: string; label: string }[];
}

function initialFromTarget(target?: CustomAttribute): FormState {
  if (!target) {
    return {
      label: "",
      key: "",
      type: "text",
      required: false,
      isUnique: false,
      visibleInList: false,
      searchable: false,
      sortable: false,
      piiMasked: false,
      position: 0,
      placeholder: "",
      helpText: "",
      minLength: "",
      maxLength: "",
      minValue: "",
      maxValue: "",
      options: [],
    };
  }
  const t = target as unknown as Record<string, unknown>;
  const opts = Array.isArray(t.options)
    ? (t.options as { value: string; label: string }[])
    : [];
  return {
    label: String(t.label ?? ""),
    key: String(t.key ?? ""),
    type: (t.type as AttrType) ?? "text",
    required: Boolean(t.required),
    isUnique: Boolean(t.isUnique),
    visibleInList: Boolean(t.visibleInList),
    searchable: Boolean(t.searchable),
    sortable: Boolean(t.sortable),
    piiMasked: Boolean(t.piiMasked),
    position: Number(t.position ?? 0),
    placeholder: String(t.placeholder ?? ""),
    helpText: String(t.helpText ?? ""),
    minLength: t.minLength == null ? "" : String(t.minLength),
    maxLength: t.maxLength == null ? "" : String(t.maxLength),
    minValue: t.minValue == null ? "" : String(t.minValue),
    maxValue: t.maxValue == null ? "" : String(t.maxValue),
    options: opts,
  };
}

export function AttrFormDialog({
  mode,
  entity,
  target,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [state, setState] = useState<FormState>(initialFromTarget(target));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    setState(initialFromTarget(target));
    setError(null);
  }, [target, open]);

  const showOptions = useMemo(
    () => state.type === "select" || state.type === "multi_select",
    [state.type],
  );

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((prev) => ({ ...prev, [k]: v }));
  }

  function addOption() {
    set("options", [...state.options, { value: "", label: "" }]);
  }
  function removeOption(i: number) {
    set(
      "options",
      state.options.filter((_, idx) => idx !== i),
    );
  }
  function updateOption(
    i: number,
    field: "value" | "label",
    v: string,
  ) {
    set(
      "options",
      state.options.map((o, idx) =>
        idx === i ? { ...o, [field]: v } : o,
      ),
    );
  }

  function parseOptionalInt(raw: string): number | null | undefined {
    if (raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startSaving(async () => {
      if (mode === "create") {
        const input: CreateCustomAttributeInput = {
          entity,
          key: state.key.trim(),
          label: state.label.trim(),
          type: state.type,
          required: state.required,
          isUnique: state.isUnique,
          visibleInList: state.visibleInList,
          searchable: state.searchable,
          sortable: state.sortable,
          piiMasked: state.piiMasked,
          position: state.position,
          placeholder: state.placeholder || undefined,
          helpText: state.helpText || undefined,
          minLength: parseOptionalInt(state.minLength) ?? undefined,
          maxLength: parseOptionalInt(state.maxLength) ?? undefined,
          options: showOptions
            ? state.options.filter((o) => o.value && o.label)
            : undefined,
        };

        const res = await createCustomAttribute(input);
        if (res.success) {
          toast.success("Atributo criado");
          await onSuccess();
        } else {
          setError(res.error ?? "Erro ao criar atributo");
        }
      } else {
        if (!target) return;
        const patch: UpdateCustomAttributeInput = {
          label: state.label.trim(),
          required: state.required,
          isUnique: state.isUnique,
          visibleInList: state.visibleInList,
          searchable: state.searchable,
          sortable: state.sortable,
          piiMasked: state.piiMasked,
          position: state.position,
          placeholder: state.placeholder || undefined,
          helpText: state.helpText || undefined,
          minLength: parseOptionalInt(state.minLength) ?? undefined,
          maxLength: parseOptionalInt(state.maxLength) ?? undefined,
          options: showOptions
            ? state.options.filter((o) => o.value && o.label)
            : undefined,
        };
        const res = await updateCustomAttribute(target.id, patch);
        if (res.success) {
          toast.success("Atributo atualizado");
          await onSuccess();
        } else {
          setError(res.error ?? "Erro ao atualizar atributo");
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Novo atributo personalizado"
              : "Editar atributo"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Configure um campo customizado para ${entity}.`
              : "Altere metadata. Tipo e chave não podem ser modificados."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={state.label}
                onChange={(e) => set("label", e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">Key *</Label>
              <Input
                id="key"
                value={state.key}
                onChange={(e) => set("key", e.target.value)}
                disabled={mode === "edit"}
                required
                placeholder="cnpj_secundario"
                pattern="^[a-z][a-z0-9_]{1,79}$"
              />
              <p className="text-[11px] text-muted-foreground">
                Letras minúsculas, números e underscore. Imutável após criação.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipo *</Label>
              <select
                id="type"
                value={state.type}
                onChange={(e) => set("type", e.target.value as AttrType)}
                disabled={mode === "edit"}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position">Posição</Label>
              <Input
                id="position"
                type="number"
                min={0}
                value={state.position}
                onChange={(e) => set("position", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="placeholder">Placeholder</Label>
              <Input
                id="placeholder"
                value={state.placeholder}
                onChange={(e) => set("placeholder", e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="helpText">Texto de ajuda</Label>
              <Input
                id="helpText"
                value={state.helpText}
                onChange={(e) => set("helpText", e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minLength">minLength</Label>
              <Input
                id="minLength"
                type="number"
                min={0}
                value={state.minLength}
                onChange={(e) => set("minLength", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxLength">maxLength</Label>
              <Input
                id="maxLength"
                type="number"
                min={1}
                value={state.maxLength}
                onChange={(e) => set("maxLength", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minValue">minValue</Label>
              <Input
                id="minValue"
                type="number"
                value={state.minValue}
                onChange={(e) => set("minValue", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxValue">maxValue</Label>
              <Input
                id="maxValue"
                type="number"
                value={state.maxValue}
                onChange={(e) => set("maxValue", e.target.value)}
              />
            </div>
          </div>

          {showOptions && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Opções</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addOption}
                  className="h-7 gap-1 text-xs cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              </div>
              {state.options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Adicione ao menos uma opção.
                </p>
              )}
              <div className="space-y-2">
                {state.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="value"
                      value={opt.value}
                      onChange={(e) =>
                        updateOption(i, "value", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Input
                      placeholder="label"
                      value={opt.label}
                      onChange={(e) =>
                        updateOption(i, "label", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(i)}
                      className="h-10 w-10 p-0 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover opção"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FlagToggle
              id="required"
              label="Required"
              value={state.required}
              onChange={(v) => set("required", v)}
            />
            <FlagToggle
              id="isUnique"
              label="Unique"
              value={state.isUnique}
              onChange={(v) => set("isUnique", v)}
            />
            <FlagToggle
              id="visibleInList"
              label="Visível na lista"
              value={state.visibleInList}
              onChange={(v) => set("visibleInList", v)}
            />
            <FlagToggle
              id="searchable"
              label="Searchable"
              value={state.searchable}
              onChange={(v) => set("searchable", v)}
            />
            <FlagToggle
              id="sortable"
              label="Sortable"
              value={state.sortable}
              onChange={(v) => set("sortable", v)}
            />
            <FlagToggle
              id="piiMasked"
              label="PII Masked"
              value={state.piiMasked}
              onChange={(v) => set("piiMasked", v)}
            />
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FlagToggle({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label htmlFor={id} className="text-xs cursor-pointer">
        {label}
      </Label>
      <Switch id={id} checked={value} onCheckedChange={onChange} />
    </div>
  );
}
