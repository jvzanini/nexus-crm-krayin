"use client";

import { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  PageHeader,
} from "@nexusai360/design-system";
import {
  CheckSquare,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  listMyTasks,
  completeActivity,
  cancelActivity,
  deleteActivity,
  createActivity,
  updateActivity,
} from "@/lib/actions/activities";
import type { ActivityItem } from "@/lib/actions/activities";

// ---------------------------------------------------------------------------
// Variants de animação (stagger 0.08 conforme padrão)
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
// Filtros de status
// ---------------------------------------------------------------------------

// STATUS_FILTERS labels são traduzidos no render via useTranslations
const STATUS_FILTER_VALUES = ["all", "pending", "completed", "canceled"] as const;

type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];

// ---------------------------------------------------------------------------
// Badge de status
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ActivityItem["status"] }) {
  const configs = {
    pending: {
      label: "Pendente",
      className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    completed: {
      label: "Concluída",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    canceled: {
      label: "Cancelada",
      className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    },
  };

  const cfg = configs[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-muted/50 border border-border"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TasksContentProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canComplete: boolean;
}

// ---------------------------------------------------------------------------
// Helpers para o form inline
// ---------------------------------------------------------------------------

function toDatetimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOWithOffset(datetimeLocal: string): string | undefined {
  if (!datetimeLocal) return undefined;
  const d = new Date(datetimeLocal);
  if (isNaN(d.getTime())) return undefined;
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - tzOffsetMs);
  const tzOffset = -d.getTimezoneOffset();
  const sign = tzOffset >= 0 ? "+" : "-";
  const absOffset = Math.abs(tzOffset);
  const hh = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const mm = String(absOffset % 60).padStart(2, "0");
  return `${localDate.toISOString().slice(0, -1)}${sign}${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Componente de form de tarefa (standalone ou vinculada a subject)
// ---------------------------------------------------------------------------

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: ActivityItem;
  mode: "create" | "edit";
  onSaved: () => void;
}

function TaskFormDialog({
  open,
  onOpenChange,
  initial,
  mode,
  onSaved,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt));
  const [reminderAt, setReminderAt] = useState(toDatetimeLocal(initial?.reminderAt));
  // Subject opcional para tasks criadas na página de tasks
  const [subjectType, setSubjectType] = useState<"lead" | "contact" | "opportunity">("lead");
  const [subjectId, setSubjectId] = useState("");

  const [saving, startSaving] = useTransition();

  const inputClass =
    "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground";
  const labelClass = "block text-sm font-medium text-foreground/80 mb-1.5";

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setTitle("");
      setDescription("");
      setDueAt("");
      setReminderAt("");
      setSubjectType("lead");
      setSubjectId("");
    } else if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setDueAt(toDatetimeLocal(initial.dueAt));
      setReminderAt(toDatetimeLocal(initial.reminderAt));
      setSubjectType(initial.subjectType as "lead" | "contact" | "opportunity");
      setSubjectId(initial.subjectId);
    }
  }, [open, mode, initial]);

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (mode === "create" && !subjectId.trim()) {
      toast.error("ID do assunto é obrigatório");
      return;
    }

    startSaving(async () => {
      if (mode === "create") {
        const result = await createActivity({
          type: "task",
          subjectType,
          subjectId: subjectId.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          dueAt: toISOWithOffset(dueAt),
          reminderAt: toISOWithOffset(reminderAt),
        });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao criar tarefa");
          return;
        }
        toast.success("Tarefa criada");
      } else {
        if (!initial) return;
        const result = await updateActivity(initial.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          dueAt: toISOWithOffset(dueAt),
          reminderAt: toISOWithOffset(reminderAt),
        });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar tarefa");
          return;
        }
        toast.success("Tarefa salva");
      }
      onSaved();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova tarefa" : "Editar tarefa"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Criar" : "Salvar"} — Tarefa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className={labelClass}>Título *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título"
              className={inputClass}
              disabled={saving}
            />
          </div>

          {/* Subject (apenas no create) */}
          {mode === "create" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Tipo de assunto *</label>
                <select
                  value={subjectType}
                  onChange={(e) =>
                    setSubjectType(e.target.value as "lead" | "contact" | "opportunity")
                  }
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="lead">Lead</option>
                  <option value="contact">Contato</option>
                  <option value="opportunity">Oportunidade</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>ID do assunto *</label>
                <Input
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder="UUID do lead/contato/oportunidade"
                  className={inputClass}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {/* Prazo + Lembrete */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Vencimento</label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className={inputClass}
                disabled={saving}
              />
            </div>
            <div>
              <label className={labelClass}>Lembrete em</label>
              <Input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className={inputClass}
                disabled={saving}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes da tarefa"
              rows={3}
              disabled={saving}
              className="flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Criar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function TasksContent({
  canCreate,
  canEdit,
  canDelete,
  canComplete,
}: TasksContentProps) {
  const [tasks, setTasks] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filtros ---
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [dueWithinDays, setDueWithinDays] = useState<string>("");

  // --- Form nova tarefa ---
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ActivityItem | null>(null);

  // --- Delete dialog ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<ActivityItem | null>(null);

  // --- Transitions ---
  const [completing, startCompleting] = useTransition();
  const [canceling, startCanceling] = useTransition();
  const [deleting, startDeleting] = useTransition();

  // ---------------------------------------------------------------------------
  // Carregar
  // ---------------------------------------------------------------------------

  async function load() {
    setLoading(true);
    const filter: { status?: ActivityItem["status"]; dueWithinDays?: number } = {};
    if (statusFilter !== "all") {
      filter.status = statusFilter as ActivityItem["status"];
    }
    if (dueWithinDays && !isNaN(Number(dueWithinDays))) {
      filter.dueWithinDays = Number(dueWithinDays);
    }

    const result = await listMyTasks(filter);
    if (result.success && result.data) {
      setTasks(result.data);
    } else {
      toast.error(result.error ?? "Sem tarefas registradas");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dueWithinDays]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openCreate() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEdit(task: ActivityItem) {
    setEditingTask(task);
    setFormOpen(true);
  }

  function handleComplete(task: ActivityItem) {
    startCompleting(async () => {
      const result = await completeActivity(task.id);
      if (result.success) {
        toast.success("Tarefa concluída");
        await load();
      } else {
        toast.error(result.error ?? "Erro ao concluir tarefa");
      }
    });
  }

  function handleCancel(task: ActivityItem) {
    startCanceling(async () => {
      const result = await cancelActivity(task.id);
      if (result.success) {
        toast.success("Tarefa cancelada");
        await load();
      } else {
        toast.error(result.error ?? "Erro ao cancelar tarefa");
      }
    });
  }

  function openDeleteDialog(task: ActivityItem) {
    setDeletingTask(task);
    setDeleteDialogOpen(true);
  }

  function handleDelete() {
    if (!deletingTask) return;
    startDeleting(async () => {
      const result = await deleteActivity(deletingTask.id);
      if (result.success) {
        toast.success("Tarefa excluída");
        setDeleteDialogOpen(false);
        setDeletingTask(null);
        await load();
      } else {
        toast.error(result.error ?? "Erro ao excluir tarefa");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <PageHeader.Root>
          <PageHeader.Row>
            <PageHeader.Icon icon={CheckSquare} color="emerald" />
            <PageHeader.Heading>
              <PageHeader.Title>Tarefas</PageHeader.Title>
              <PageHeader.Description>
                {loading
                  ? "..."
                  : tasks.length === 0
                    ? "Sem tarefas"
                    : tasks.length === 1
                      ? "1 tarefa registrada"
                      : `${tasks.length} tarefas registradas`}
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
          {canCreate && (
            <PageHeader.Actions>
              <Button
                onClick={openCreate}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            </PageHeader.Actions>
          )}
        </PageHeader.Root>
      </motion.div>

      {/* Filtros */}
      <motion.div variants={itemVariants} className="space-y-3">
        {/* Pills de status */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTER_VALUES.map((val) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                statusFilter === val
                  ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {val === "all" ? "Todas"
                : val === "pending" ? "Pendentes"
                : val === "completed" ? "Concluídas"
                : "Canceladas"}
            </button>
          ))}
        </div>

        {/* Filtro por dias */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground shrink-0">
            Vencimento em (dias):
          </label>
          <Input
            type="number"
            value={dueWithinDays}
            onChange={(e) => setDueWithinDays(e.target.value)}
            placeholder="Ex: 7"
            min={1}
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground max-w-[80px]"
          />
          <span className="text-sm text-muted-foreground">dias</span>
          {dueWithinDays && (
            <button
              type="button"
              onClick={() => setDueWithinDays("")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Tabela */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckSquare className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="text-sm">Sem tarefas registradas ainda</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Título</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Vencimento</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                {(canEdit || canDelete || canComplete) && (
                  <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task, index) => {
                const isPending = task.status === "pending";
                return (
                  <motion.tr
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.03,
                      ease: "easeOut" as const,
                    }}
                    className="border-border hover:bg-accent/30 transition-colors duration-200"
                  >
                    <TableCell className="text-foreground font-medium">
                      {task.title}
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                      {task.dueAt
                        ? format(new Date(task.dueAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={task.status} />
                    </TableCell>
                    {(canEdit || canDelete || canComplete) && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canComplete && isPending && (
                            <button
                              type="button"
                              onClick={() => handleComplete(task)}
                              disabled={completing}
                              title="Concluir"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition-all duration-200 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(task)}
                                title="Editar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(task)}
                                disabled={canceling}
                                title="Cancelar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-all duration-200 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(task)}
                              title="Excluir"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Form de tarefa */}
      {formOpen && (
        <TaskFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={editingTask ?? undefined}
          mode={editingTask ? "edit" : "create"}
          onSaved={load}
        />
      )}

      {/* AlertDialog — Excluir tarefa */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {deletingTask?.title
                ? `Excluir permanentemente "${deletingTask.title}"?`
                : "Excluir"}
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
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
