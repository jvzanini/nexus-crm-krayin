"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { FilterBar, type FilterConfig } from "@/components/tables/filter-bar";
import { useSavedFilters } from "@/hooks/use-saved-filters";
import { WorkflowsFiltersSchema, type WorkflowsFilters } from "@/lib/actions/workflows-schemas";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nexusai360/design-system";
import { Button } from "@nexusai360/design-system";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nexusai360/design-system";
import { PageHeader, IconTile } from "@nexusai360/design-system";
import { CrmListShell } from "@nexusai360/patterns";
import { EmptyState } from "@nexusai360/design-system";
import {
  Workflow,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import {
  listWorkflowsAction,
  setWorkflowStatusAction,
  deleteWorkflowAction,
  deleteWorkflowsBulkAction,
} from "@/lib/actions/workflows";
import type { WorkflowItem } from "@/lib/actions/workflows";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";

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
// Badges helpers
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<WorkflowItem["trigger"], string> = {
  lead_created: "Lead criado",
  contact_created: "Contato criado",
  activity_completed: "Atividade concluída",
};

const TRIGGER_COLORS: Record<WorkflowItem["trigger"], string> = {
  lead_created: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  contact_created: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  activity_completed: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

const STATUS_LABELS: Record<WorkflowItem["status"], string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
};

const STATUS_COLORS: Record<WorkflowItem["status"], string> = {
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-muted/50 border border-border"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface WorkflowsListContentProps {
  canManage: boolean;
  initialFilters?: Record<string, string | undefined>;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
];

const TRIGGER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "lead_created", label: "Lead criado" },
  { value: "contact_created", label: "Contato criado" },
  { value: "activity_completed", label: "Atividade concluída" },
];

export function WorkflowsListContent({
  canManage,
  initialFilters = {},
}: WorkflowsListContentProps) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filters (URL-based) ---
  const [filters, setFilters] = useState<WorkflowsFilters>(() => {
    const parsed = WorkflowsFiltersSchema.safeParse(initialFilters);
    return parsed.success ? parsed.data : {};
  });
  const [qInput, setQInput] = useState<string>(initialFilters.q ?? "");
  const debouncedQ = useDebouncedValue(qInput, 300);

  // --- Delete dialog ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowItem | null>(null);

  // --- Transitions ---
  const [toggling, startToggling] = useTransition();
  const [deleting, startDeleting] = useTransition();

  // --- Bulk selection ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const saved = useSavedFilters("workflows");
  const currentFiltersAsRecord = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        out[k] = String(v);
      }
    }
    return out;
  }, [filters]);
  function onApplySavedWorkflowsFilter(f: Record<string, string>) {
    const parsed = WorkflowsFiltersSchema.safeParse(f);
    if (parsed.success) {
      setFilters(parsed.data);
      setQInput(parsed.data.q ?? "");
      setSelectedIds(new Set());
    }
  }
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(rowIds: string[]) {
    const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(rowIds));
  }
  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulkDeleting(async () => {
      const result = await deleteWorkflowsBulkAction(ids);
      if (result.success && result.data) {
        toast.success(
          `${result.data.deletedCount} workflow${result.data.deletedCount === 1 ? "" : "s"} excluído${result.data.deletedCount === 1 ? "" : "s"}`,
        );
        await loadWorkflows();
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao excluir workflows");
      }
      setBulkDeleteDialogOpen(false);
    });
  }

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------

  async function loadWorkflows(f: WorkflowsFilters = filters) {
    setLoading(true);
    const result = await listWorkflowsAction(f);
    if (result.success && result.data) {
      setWorkflows(result.data);
    } else {
      toast.error(result.error ?? "Erro ao carregar workflows");
    }
    setLoading(false);
  }

  // Sync debounced q into filters
  useEffect(() => {
    const trimmed = debouncedQ.trim();
    setFilters((prev) => ({
      ...prev,
      q: trimmed === "" ? undefined : trimmed,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // Load + URL sync whenever filters change
  const didMount = useRef(false);
  useEffect(() => {
    loadWorkflows(filters);
    if (!didMount.current) {
      // Primeira render: não sujar history; URL já reflete initialFilters SSR.
      didMount.current = true;
      return;
    }
    const qs = new URLSearchParams();
    if (filters.status) qs.set("status", filters.status);
    if (filters.trigger) qs.set("trigger", filters.trigger);
    if (filters.q) qs.set("q", filters.q);
    const s = qs.toString();
    router.replace(`/automation/workflows${s ? "?" + s : ""}`);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.trigger, filters.q]);

  const hasActiveFilters = useMemo(
    () => Boolean(filters.status || filters.trigger || filters.q),
    [filters],
  );

  function updateFilter(key: string, value: string) {
    if (key === "q") {
      setQInput(value);
      return;
    }
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" || value === "all" ? undefined : (value as never),
    }));
  }

  function clearFilters() {
    setFilters({});
    setQInput("");
    router.replace("/automation/workflows");
  }

  const filterConfigs: FilterConfig[] = [
    {
      type: "input",
      key: "q",
      label: "Buscar",
      value: qInput,
      placeholder: "Nome do workflow",
    },
    {
      type: "select",
      key: "status",
      label: "Status",
      value: filters.status ?? "all",
      options: STATUS_OPTIONS,
    },
    {
      type: "select",
      key: "trigger",
      label: "Disparo",
      value: filters.trigger ?? "all",
      options: TRIGGER_OPTIONS,
    },
  ];

  // ---------------------------------------------------------------------------
  // Toggle status
  // ---------------------------------------------------------------------------

  function handleToggleStatus(workflow: WorkflowItem) {
    const nextStatus: WorkflowItem["status"] =
      workflow.status === "active" ? "paused" : "active";

    startToggling(async () => {
      const result = await setWorkflowStatusAction(workflow.id, nextStatus);
      if (result.success) {
        const label = nextStatus === "active" ? "ativado" : "pausado";
        toast.success(`Workflow "${workflow.name}" ${label}`);
        await loadWorkflows();
      } else {
        toast.error(result.error ?? "Erro ao alterar status");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  function openDeleteDialog(workflow: WorkflowItem) {
    setDeletingWorkflow(workflow);
    setDeleteDialogOpen(true);
  }

  function handleDelete() {
    if (!deletingWorkflow) return;

    startDeleting(async () => {
      const result = await deleteWorkflowAction(deletingWorkflow.id);
      if (result.success) {
        toast.success(`Workflow "${deletingWorkflow.name}" excluído`);
        setDeleteDialogOpen(false);
        setDeletingWorkflow(null);
        await loadWorkflows();
      } else {
        toast.error(result.error ?? "Erro ao excluir workflow");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // JSX principal
  // ---------------------------------------------------------------------------

  const workflowsDesc = loading
    ? "Carregando..."
    : workflows.length === 0
      ? "Nenhum workflow cadastrado"
      : `${workflows.length} workflow${workflows.length !== 1 ? "s" : ""} cadastrado${workflows.length !== 1 ? "s" : ""}`;

  return (
    <CrmListShell
      title="Workflows de automação"
      description={workflowsDesc}
      icon={<IconTile icon={Workflow} color="violet" />}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Automação" },
        { label: "Workflows" },
      ]}
      actions={
        canManage ? (
          <Button
            onClick={() => router.push("/automation/workflows/new")}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Novo workflow
          </Button>
        ) : null
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >

      {/* Filtros */}
      <motion.div variants={itemVariants}>
        <FilterBar
          filters={filterConfigs}
          onChange={updateFilter}
          onClear={clearFilters}
          hasActive={hasActiveFilters}
          savedFilters={{
            moduleKey: "workflows",
            current: currentFiltersAsRecord,
            list: saved.list,
            onApply: onApplySavedWorkflowsFilter,
            onListChange: saved.reload,
          }}
        />
      </motion.div>

      {/* Bulk action bar */}
      {canManage && (
        <BulkActionBar
          count={selectedIds.size}
          onCancel={() => setSelectedIds(new Set())}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          entityLabel="workflow"
          entityPlural="workflows"
        />
      )}

      {/* Tabela */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : workflows.length === 0 ? (
          <EmptyState.Root>
            <EmptyState.Icon icon={Workflow} color="purple" />
            <EmptyState.Title>
              {hasActiveFilters
                ? "Nenhum workflow encontrado"
                : "Nenhuma automação criada"}
            </EmptyState.Title>
            <EmptyState.Description>
              {hasActiveFilters
                ? "Ajuste os filtros para ver mais resultados."
                : "Automatize tarefas repetitivas criando workflows."}
            </EmptyState.Description>
            {canManage && !hasActiveFilters && (
              <EmptyState.Action>
                <Button
                  onClick={() => router.push("/automation/workflows/new")}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Novo workflow
                </Button>
              </EmptyState.Action>
            )}
            {hasActiveFilters && (
              <EmptyState.Action>
                <Button
                  onClick={clearFilters}
                  className="bg-transparent border border-border text-muted-foreground hover:bg-muted/50 cursor-pointer"
                >
                  Limpar filtros
                </Button>
              </EmptyState.Action>
            )}
          </EmptyState.Root>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {canManage && (
                  <TableHead className="text-muted-foreground w-10">
                    <Checkbox
                      checked={
                        workflows.length > 0 &&
                        workflows.every((w) => selectedIds.has(w.id))
                      }
                      indeterminate={
                        selectedIds.size > 0 &&
                        !workflows.every((w) => selectedIds.has(w.id))
                      }
                      onCheckedChange={() =>
                        toggleAll(workflows.map((w) => w.id))
                      }
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Disparo</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Versão</TableHead>
                {canManage && (
                  <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow, index) => (
                <motion.tr
                  key={workflow.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.03,
                    ease: "easeOut" as const,
                  }}
                  className="border-border hover:bg-accent/30 transition-colors duration-200"
                >
                  {canManage && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedIds.has(workflow.id)}
                        onCheckedChange={() => toggleRow(workflow.id)}
                        aria-label={`Selecionar ${workflow.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-foreground font-medium">
                    <div>
                      <p>{workflow.name}</p>
                      {workflow.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TRIGGER_COLORS[workflow.trigger]}`}
                    >
                      <GitBranch className="h-3 w-3" />
                      {TRIGGER_LABELS[workflow.trigger]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[workflow.status]}`}
                    >
                      {STATUS_LABELS[workflow.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    v{workflow.version}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/automation/workflows/${workflow.id}`)}
                          title="Editar workflow"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {workflow.status !== "draft" && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(workflow)}
                            disabled={toggling}
                            title={workflow.status === "active" ? "Pausar" : "Retomar"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-all duration-200 disabled:opacity-50"
                          >
                            {workflow.status === "active" ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(workflow)}
                          title="Excluir workflow"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* AlertDialog — Bulk delete */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir workflows selecionados
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              workflow{selectedIds.size === 1 ? "" : "s"}? Histórico de execuções será removido em cascata. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkDeleting}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-all duration-200"
            >
              {bulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog — Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir workflow
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Excluir workflow{" "}
              <strong className="text-foreground">
                &quot;{deletingWorkflow?.name}&quot;
              </strong>
              ? Histórico de execuções será removido em cascata. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-all duration-200"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </motion.div>
    </CrmListShell>
  );
}
