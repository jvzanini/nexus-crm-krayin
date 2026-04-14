"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, PageHeader } from "@nexusai360/design-system";
import { Layers, Plus, Trash2, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  createSegmentAction,
  updateSegmentAction,
  previewSegmentAction,
} from "@/lib/actions/marketing-segments";
import type { SegmentItem } from "@/lib/actions/marketing-segments";
import type { SegmentFilter } from "@/lib/marketing/segment";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type OpValue = "eq" | "neq" | "in" | "gt" | "lt" | "contains";

// ---------------------------------------------------------------------------
// Variants de animação
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// ---------------------------------------------------------------------------
// Opções de campos e operadores
// ---------------------------------------------------------------------------

const FIELD_OPTIONS = [
  { value: "email", label: "E-mail" },
  { value: "organization", label: "Organização" },
  { value: "title", label: "Cargo" },
  { value: "createdAt", label: "Criado em" },
  { value: "consentMarketing", label: "Aceita marketing" },
  { value: "consentTracking", label: "Aceita tracking" },
] as const;

const OP_OPTIONS = [
  { value: "eq", label: "Igual a" },
  { value: "neq", label: "Diferente de" },
  { value: "in", label: "Em (lista)" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
  { value: "contains", label: "Contém" },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SegmentEditorContentProps {
  mode: "create" | "edit";
  segment?: SegmentItem;
  canManage?: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SegmentEditorContent({
  mode,
  segment,
  canManage = true,
}: SegmentEditorContentProps) {
  const router = useRouter();

  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [filters, setFilters] = useState<SegmentFilter[]>(
    segment?.filters ?? [],
  );

  const [saving, startSaving] = useTransition();
  const [previewing, startPreviewing] = useTransition();

  const [previewData, setPreviewData] = useState<{
    count: number;
    sample: { id: string; email: string | null; firstName: string; lastName: string }[];
  } | null>(null);

  const isPending = saving || previewing;

  // ---------------------------------------------------------------------------
  // Filtros helpers
  // ---------------------------------------------------------------------------

  function addFilter() {
    if (filters.length >= 20) {
      toast.error("Máximo de 20 filtros atingido");
      return;
    }
    setFilters((prev) => [...prev, { field: "email", op: "eq", value: "" }]);
  }

  function updateFilter(index: number, patch: Partial<SegmentFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  function handlePreview() {
    startPreviewing(async () => {
      const result = await previewSegmentAction({ filters });
      if (result.success && result.data) {
        setPreviewData(result.data);
      } else {
        toast.error(result.error ?? "Erro ao calcular prévia");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  function handleSave() {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    startSaving(async () => {
      if (mode === "create") {
        const result = await createSegmentAction({
          name: name.trim(),
          description: description.trim() || undefined,
          filters,
        });
        if (result.success) {
          toast.success("Segmento criado com sucesso");
          router.push("/marketing/segments");
        } else {
          toast.error(result.error ?? "Erro ao criar segmento");
        }
      } else {
        const result = await updateSegmentAction(segment!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          filters,
        });
        if (result.success) {
          toast.success("Segmento atualizado");
          router.push("/marketing/segments");
        } else {
          toast.error(result.error ?? "Erro ao atualizar segmento");
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers de estilo
  // ---------------------------------------------------------------------------

  const inputClass = "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground";
  const selectClass =
    "flex h-9 rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-3xl"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <PageHeader.Root>
          <PageHeader.Row>
            <PageHeader.Icon icon={Layers} color="blue" />
            <PageHeader.Heading>
              <PageHeader.Title>
                {mode === "create" ? "Novo segmento" : "Editar segmento"}
              </PageHeader.Title>
              <PageHeader.Description>
                Defina critérios de filtro para agrupar contatos
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
        </PageHeader.Root>
      </motion.div>

      {/* Identificação */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Nome *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Leads que aceitam marketing"
            className={inputClass}
            disabled={isPending || !canManage}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Descrição
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o que este segmento representa..."
            rows={2}
            disabled={isPending || !canManage}
            className="flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
          {canManage && filters.length < 20 && (
            <button
              type="button"
              onClick={addFilter}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Adicionar filtro
            </button>
          )}
        </div>

        {filters.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
            Nenhum filtro — o segmento incluirá todos os contatos com consent marketing.
          </p>
        ) : (
          <div className="space-y-2">
            {filters.map((filter, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20"
              >
                <select
                  value={filter.field}
                  onChange={(e) => updateFilter(index, { field: e.target.value })}
                  disabled={isPending || !canManage}
                  className="flex h-8 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.op}
                  onChange={(e) => updateFilter(index, { op: e.target.value as OpValue })}
                  disabled={isPending || !canManage}
                  className="flex h-8 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
                >
                  {OP_OPTIONS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <input
                  value={String(filter.value ?? "")}
                  onChange={(e) => updateFilter(index, { value: e.target.value })}
                  placeholder="valor"
                  disabled={isPending || !canManage}
                  className="flex h-8 flex-1 min-w-0 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {canManage && (
                  <button
                    type="button"
                    onClick={() => removeFilter(index)}
                    disabled={isPending}
                    title="Remover filtro"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Prévia */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Prévia</h2>
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors disabled:opacity-50"
          >
            {previewing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            Calcular prévia
          </button>
        </div>

        {previewData ? (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              <span className="font-semibold text-violet-400">{previewData.count}</span>{" "}
              contatos correspondem a este segmento
            </p>
            {previewData.sample.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Amostra (até 5):</p>
                <div className="space-y-1">
                  {previewData.sample.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 text-xs text-muted-foreground p-1.5 rounded-md bg-muted/30"
                    >
                      <span className="font-medium text-foreground">{`${contact.firstName} ${contact.lastName}`.trim()}</span>
                      {contact.email && <span>{contact.email}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Clique em &quot;Calcular prévia&quot; para ver quantos contatos correspondem ao segmento.
          </p>
        )}
      </motion.div>

      {/* Botões */}
      {canManage && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 pb-8"
        >
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Criar segmento" : "Salvar alterações"}
          </Button>
          <button
            type="button"
            onClick={() => router.push("/marketing/segments")}
            disabled={isPending}
            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
