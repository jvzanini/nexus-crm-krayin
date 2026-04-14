"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@nexusai360/design-system";
import { Input } from "@nexusai360/design-system";
import {
  Workflow,
  Plus,
  Trash2,
  Loader2,
  GitBranch,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import {
  createWorkflowAction,
  updateWorkflowAction,
} from "@/lib/actions/workflows";
import type { WorkflowItem, Condition, ActionSpec } from "@/lib/actions/workflows";

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

type ConditionRow = Condition;

type ActionRow = ActionSpec;

interface WorkflowEditorContentProps {
  workflow?: WorkflowItem;
  canManage: boolean;
  mode: "create" | "edit";
}

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
// Opções
// ---------------------------------------------------------------------------

const TRIGGER_OPTIONS = [
  { value: "lead_created", label: "Lead criado" },
  { value: "contact_created", label: "Contato criado" },
  { value: "activity_completed", label: "Atividade concluída" },
] as const;

const OP_OPTIONS = [
  { value: "eq", label: "Igual a" },
  { value: "neq", label: "Diferente de" },
  { value: "in", label: "Em (lista)" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
  { value: "contains", label: "Contém" },
] as const;

const ACTION_TYPE_OPTIONS = [
  { value: "update-field", label: "Atualizar campo" },
  { value: "create-task", label: "Criar tarefa" },
  { value: "assign-user", label: "Atribuir usuário" },
  { value: "send-email", label: "Enviar e-mail" },
] as const;

type TriggerValue = (typeof TRIGGER_OPTIONS)[number]["value"];
type OpValue = (typeof OP_OPTIONS)[number]["value"];
type ActionTypeValue = (typeof ACTION_TYPE_OPTIONS)[number]["value"];

// ---------------------------------------------------------------------------
// Helpers de serialização de params
// ---------------------------------------------------------------------------

function emptyParamsForType(type: ActionTypeValue): Record<string, string> {
  switch (type) {
    case "update-field":
      return { entityType: "lead", idField: "", field: "", value: "" };
    case "create-task":
      return { title: "", dueInHours: "24", assignedTo: "" };
    case "assign-user":
      return { entityType: "lead", idField: "", userId: "" };
    case "send-email":
      return { mailboxId: "", subject: "", bodyHtml: "", toField: "email" };
  }
}

// ---------------------------------------------------------------------------
// Sub-component: params editor por tipo
// ---------------------------------------------------------------------------

interface ParamsEditorProps {
  type: ActionTypeValue;
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
  disabled?: boolean;
}

function ParamsEditor({ type, params, onChange, disabled }: ParamsEditorProps) {
  function set(key: string, value: string) {
    onChange({ ...params, [key]: value });
  }

  const inputClass =
    "flex h-8 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const selectClass =
    "flex h-8 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  if (type === "update-field") {
    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Entidade
          </label>
          <select
            value={params.entityType ?? "lead"}
            onChange={(e) => set("entityType", e.target.value)}
            disabled={disabled}
            className={selectClass + " w-full"}
          >
            <option value="lead">Lead</option>
            <option value="contact">Contato</option>
            <option value="opportunity">Oportunidade</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Campo ID (ex: id)
          </label>
          <input
            value={params.idField ?? ""}
            onChange={(e) => set("idField", e.target.value)}
            placeholder="id"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Campo
          </label>
          <input
            value={params.field ?? ""}
            onChange={(e) => set("field", e.target.value)}
            placeholder="ex: status"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Valor
          </label>
          <input
            value={params.value ?? ""}
            onChange={(e) => set("value", e.target.value)}
            placeholder="novo valor"
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  if (type === "create-task") {
    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Título da tarefa
          </label>
          <input
            value={params.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex: Fazer follow-up"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Vence em (horas)
          </label>
          <input
            type="number"
            value={params.dueInHours ?? "24"}
            onChange={(e) => set("dueInHours", e.target.value)}
            placeholder="24"
            min="1"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Atribuir a (UUID — opcional)
          </label>
          <input
            value={params.assignedTo ?? ""}
            onChange={(e) => set("assignedTo", e.target.value)}
            placeholder="UUID do usuário"
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  if (type === "assign-user") {
    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Entidade
          </label>
          <select
            value={params.entityType ?? "lead"}
            onChange={(e) => set("entityType", e.target.value)}
            disabled={disabled}
            className={selectClass + " w-full"}
          >
            <option value="lead">Lead</option>
            <option value="contact">Contato</option>
            <option value="opportunity">Oportunidade</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Campo ID (ex: id)
          </label>
          <input
            value={params.idField ?? ""}
            onChange={(e) => set("idField", e.target.value)}
            placeholder="id"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            UUID do usuário
          </label>
          <input
            value={params.userId ?? ""}
            onChange={(e) => set("userId", e.target.value)}
            placeholder="UUID do usuário"
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  if (type === "send-email") {
    return (
      <div className="space-y-2 mt-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1">
              Mailbox ID (UUID)
            </label>
            <input
              value={params.mailboxId ?? ""}
              onChange={(e) => set("mailboxId", e.target.value)}
              placeholder="UUID da mailbox"
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1">
              Campo destinatário (ex: email)
            </label>
            <input
              value={params.toField ?? "email"}
              onChange={(e) => set("toField", e.target.value)}
              placeholder="email"
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Assunto
          </label>
          <input
            value={params.subject ?? ""}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Assunto do e-mail"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">
            Corpo HTML
          </label>
          <textarea
            value={params.bodyHtml ?? ""}
            onChange={(e) => set("bodyHtml", e.target.value)}
            placeholder="<p>Olá {{name}},</p>"
            rows={3}
            disabled={disabled}
            className="flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function WorkflowEditorContent({
  workflow,
  canManage,
  mode,
}: WorkflowEditorContentProps) {
  const router = useRouter();

  // --- Campos básicos ---
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [trigger, setTrigger] = useState<TriggerValue>(
    workflow?.trigger ?? "lead_created",
  );

  // --- Condições ---
  const [conditions, setConditions] = useState<ConditionRow[]>(
    workflow?.conditions ?? [],
  );

  // --- Ações ---
  const [actions, setActions] = useState<ActionRow[]>(
    workflow?.actions ?? [],
  );

  // --- Submitting ---
  const [saving, startSaving] = useTransition();
  const [activating, startActivating] = useTransition();

  const isPending = saving || activating;

  // ---------------------------------------------------------------------------
  // Condições helpers
  // ---------------------------------------------------------------------------

  function addCondition() {
    if (conditions.length >= 20) {
      toast.error("Máximo de 20 condições atingido");
      return;
    }
    setConditions((prev) => [
      ...prev,
      { field: "", op: "eq", value: "" },
    ]);
  }

  function updateCondition(index: number, patch: Partial<ConditionRow>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Ações helpers
  // ---------------------------------------------------------------------------

  function addAction(type: ActionTypeValue) {
    if (actions.length >= 10) {
      toast.error("Máximo de 10 ações atingido");
      return;
    }
    setActions((prev) => [
      ...prev,
      { type, params: emptyParamsForType(type) },
    ]);
  }

  function updateActionParams(index: number, params: Record<string, string>) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, params } : a,
      ),
    );
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  function buildPayload(status: "draft" | "active") {
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger,
      conditions,
      actions,
      status,
    };
  }

  function handleSaveDraft() {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    startSaving(async () => {
      if (mode === "create") {
        const result = await createWorkflowAction(buildPayload("draft"));
        if (result.success) {
          toast.success("Workflow salvo como rascunho");
          router.push("/automation/workflows");
        } else {
          toast.error(result.error ?? "Erro ao criar workflow");
        }
      } else {
        const result = await updateWorkflowAction(workflow!.id, buildPayload("draft"));
        if (result.success) {
          toast.success("Workflow atualizado");
          router.push("/automation/workflows");
        } else {
          toast.error(result.error ?? "Erro ao atualizar workflow");
        }
      }
    });
  }

  function handleActivate() {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (actions.length === 0) {
      toast.error("Adicione pelo menos uma ação para ativar o workflow");
      return;
    }

    startActivating(async () => {
      if (mode === "create") {
        const result = await createWorkflowAction(buildPayload("active"));
        if (result.success) {
          toast.success("Workflow criado e ativado");
          router.push("/automation/workflows");
        } else {
          toast.error(result.error ?? "Erro ao criar workflow");
        }
      } else {
        const result = await updateWorkflowAction(workflow!.id, buildPayload("active"));
        if (result.success) {
          toast.success("Workflow atualizado e ativado");
          router.push("/automation/workflows");
        } else {
          toast.error(result.error ?? "Erro ao atualizar workflow");
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Input class helpers
  // ---------------------------------------------------------------------------

  const inputClass =
    "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground";

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
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
          <Workflow className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === "create" ? "Novo workflow" : "Editar workflow"}
          </h1>
          {workflow && (
            <p className="text-xs text-muted-foreground">v{workflow.version}</p>
          )}
        </div>
      </motion.div>

      {/* Campos básicos */}
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
            placeholder="Ex: Notificar ao criar lead"
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
            placeholder="Descreva o que este workflow faz..."
            rows={2}
            disabled={isPending || !canManage}
            className="flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
      </motion.div>

      {/* Trigger */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-foreground">
            Disparo (quando)
          </h2>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Evento que dispara o workflow
          </label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as TriggerValue)}
            disabled={isPending || !canManage}
            className={selectClass + " w-full max-w-xs"}
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {trigger === "lead_created" && "Disparado sempre que um novo lead é criado no sistema."}
            {trigger === "contact_created" && "Disparado sempre que um novo contato é criado no sistema."}
            {trigger === "activity_completed" && "Disparado quando uma atividade é marcada como concluída."}
          </p>
        </div>
      </motion.div>

      {/* Condições */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Condições (se)
            </h2>
          </div>
          {canManage && conditions.length < 20 && (
            <button
              type="button"
              onClick={addCondition}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Adicionar condição
            </button>
          )}
        </div>

        {conditions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
            Nenhuma condição — o workflow dispara sempre.
          </p>
        ) : (
          <div className="space-y-2">
            {conditions.map((cond, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20"
              >
                <input
                  value={cond.field}
                  onChange={(e) => updateCondition(index, { field: e.target.value })}
                  placeholder="ex: status"
                  disabled={isPending || !canManage}
                  className="flex h-8 flex-1 min-w-0 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <select
                  value={cond.op}
                  onChange={(e) => updateCondition(index, { op: e.target.value as OpValue })}
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
                  value={String(cond.value ?? "")}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  placeholder="valor"
                  disabled={isPending || !canManage}
                  className="flex h-8 flex-1 min-w-0 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {canManage && (
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    disabled={isPending}
                    title="Remover condição"
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

      {/* Ações */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Ações (então)
            </h2>
          </div>
          {canManage && actions.length < 10 && (
            <div className="relative group">
              <button
                type="button"
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Adicionar ação
              </button>
              <div className="absolute right-0 top-6 z-10 hidden group-hover:block w-44 rounded-lg border border-border bg-card shadow-lg">
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => addAction(opt.value as ActionTypeValue)}
                    disabled={isPending}
                    className="flex w-full items-center px-3 py-2 text-xs text-foreground hover:bg-accent cursor-pointer transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {actions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
            Nenhuma ação adicionada.{" "}
            {canManage && "Adicione pelo menos uma para ativar."}
          </p>
        ) : (
          <div className="space-y-3">
            {actions.map((action, index) => {
              const typeLabel =
                ACTION_TYPE_OPTIONS.find((o) => o.value === action.type)?.label ?? action.type;
              return (
                <div
                  key={index}
                  className="p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-violet-400">
                      {index + 1}. {typeLabel}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        disabled={isPending}
                        title="Remover ação"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <ParamsEditor
                    type={action.type as ActionTypeValue}
                    params={action.params as Record<string, string>}
                    onChange={(params) => updateActionParams(index, params)}
                    disabled={isPending || !canManage}
                  />
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Botões */}
      {canManage && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 pb-8"
        >
          <Button
            onClick={handleSaveDraft}
            disabled={isPending}
            variant="outline"
            className="gap-2 border-border text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar rascunho
          </Button>
          <Button
            onClick={handleActivate}
            disabled={isPending || actions.length === 0}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            {activating && <Loader2 className="h-4 w-4 animate-spin" />}
            Ativar
          </Button>
          <button
            type="button"
            onClick={() => router.push("/automation/workflows")}
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
