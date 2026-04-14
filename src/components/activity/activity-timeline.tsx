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
} from "@nexusai360/design-system";
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
import {
  Phone,
  Video,
  CheckSquare,
  FileText,
  Paperclip,
  Clock,
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
  listActivitiesForSubject,
  completeActivity,
  cancelActivity,
  deleteActivity,
} from "@/lib/actions/activities";
import type { ActivityItem, ActivityType } from "@/lib/actions/activities";
import { ActivityForm } from "./activity-form";

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
// Configuração visual por tipo de activity
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  ActivityType,
  { label: string; Icon: React.ElementType; color: string; bg: string }
> = {
  call: {
    label: "Ligação",
    Icon: Phone,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  meeting: {
    label: "Reunião",
    Icon: Video,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  task: {
    label: "Tarefa",
    Icon: CheckSquare,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  note: {
    label: "Nota",
    Icon: FileText,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  file: {
    label: "Arquivo",
    Icon: Paperclip,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
};

// ---------------------------------------------------------------------------
// Badge de status
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ActivityItem["status"] }) {
  // TODO T7: extract to i18n key activities.status.*
  const configs = {
    pending: {
      label: "Pendente",
      className:
        "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    completed: {
      label: "Concluída",
      className:
        "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
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

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-muted/50 border border-border"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity type dropdown button
// ---------------------------------------------------------------------------

const TYPES: ActivityType[] = ["call", "meeting", "task", "note", "file"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityTimelineProps {
  subjectType: "lead" | "contact" | "opportunity";
  subjectId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canComplete: boolean;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ActivityTimeline({
  subjectType,
  subjectId,
  canCreate,
  canEdit,
  canDelete,
  canComplete,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Type picker ---
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [formType, setFormType] = useState<ActivityType>("task");
  const [formOpen, setFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null);

  // --- Delete dialog ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<ActivityItem | null>(null);

  // --- Transitions ---
  const [completing, startCompleting] = useTransition();
  const [canceling, startCanceling] = useTransition();
  const [deleting, startDeleting] = useTransition();

  // ---------------------------------------------------------------------------
  // Carregar
  // ---------------------------------------------------------------------------

  async function load() {
    setLoading(true);
    const result = await listActivitiesForSubject(subjectType, subjectId);
    if (result.success && result.data) {
      setActivities(result.data);
    } else {
      toast.error(result.error ?? "Erro ao carregar atividades");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, subjectId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openCreate(type: ActivityType) {
    setFormType(type);
    setEditingActivity(null);
    setTypePickerOpen(false);
    setFormOpen(true);
  }

  function openEdit(activity: ActivityItem) {
    setFormType(activity.type);
    setEditingActivity(activity);
    setFormOpen(true);
  }

  function handleComplete(activity: ActivityItem) {
    startCompleting(async () => {
      const result = await completeActivity(activity.id);
      if (result.success) {
        toast.success("Atividade concluída");
        await load();
      } else {
        toast.error(result.error ?? "Erro ao concluir atividade");
      }
    });
  }

  function handleCancel(activity: ActivityItem) {
    startCanceling(async () => {
      const result = await cancelActivity(activity.id);
      if (result.success) {
        toast.success("Atividade cancelada");
        await load();
      } else {
        toast.error(result.error ?? "Erro ao cancelar atividade");
      }
    });
  }

  function openDeleteDialog(activity: ActivityItem) {
    setDeletingActivity(activity);
    setDeleteDialogOpen(true);
  }

  function handleDelete() {
    if (!deletingActivity) return;
    startDeleting(async () => {
      const result = await deleteActivity(deletingActivity.id);
      if (result.success) {
        toast.success("Atividade excluída");
        setDeleteDialogOpen(false);
        setDeletingActivity(null);
        await load();
      } else {
        toast.error(result.error ?? "Erro ao excluir atividade");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render do subtítulo de data
  // ---------------------------------------------------------------------------

  function formatDateLabel(activity: ActivityItem): string {
    const date = activity.scheduledAt ?? activity.dueAt ?? activity.createdAt;
    return format(new Date(date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR });
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
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
            <Clock className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            {/* TODO T7: extract to i18n key activities.timeline.title */}
            <h2 className="text-xl font-bold text-foreground">Atividades</h2>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Carregando..."
                : `${activities.length} atividade${activities.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {canCreate && (
          <div className="relative">
            <Button
              onClick={() => setTypePickerOpen((v) => !v)}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              {/* TODO T7: extract to i18n key activities.action.new */}
              Nova atividade
            </Button>

            {typePickerOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-border bg-card shadow-lg overflow-hidden min-w-[160px]">
                {TYPES.map((t) => {
                  const { Icon, label, color, bg } = TYPE_CONFIG[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => openCreate(t)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${bg}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Lista */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="p-6">
            <TimelineSkeleton />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Clock className="h-12 w-12 mb-3 text-muted-foreground/60" />
            {/* TODO T7: extract to i18n key activities.timeline.empty */}
            <p className="text-sm">Sem atividades registradas ainda.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {/* TODO T7: extract to i18n key activities.timeline.columns.* */}
                <TableHead className="text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-muted-foreground">Título</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Data</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                {(canEdit || canDelete || canComplete) && (
                  <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity, index) => {
                const { Icon, label, color, bg } = TYPE_CONFIG[activity.type];
                const isPending = activity.status === "pending";
                return (
                  <motion.tr
                    key={activity.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.03,
                      ease: "easeOut" as const,
                    }}
                    className="border-border hover:bg-accent/30 transition-colors duration-200"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}
                        >
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      {activity.title}
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {activity.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                      {formatDateLabel(activity)}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={activity.status} />
                    </TableCell>
                    {(canEdit || canDelete || canComplete) && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canComplete && isPending && (
                            <button
                              type="button"
                              onClick={() => handleComplete(activity)}
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
                                onClick={() => openEdit(activity)}
                                title="Editar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(activity)}
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
                              onClick={() => openDeleteDialog(activity)}
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

      {/* Form modal */}
      {formOpen && (
        <ActivityForm
          type={formType}
          initial={editingActivity ?? undefined}
          subjectType={subjectType}
          subjectId={subjectId}
          mode={editingActivity ? "edit" : "create"}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={load}
        />
      )}

      {/* AlertDialog — Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              {/* TODO T7: extract to i18n key activities.action.delete.title */}
              Excluir atividade
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir permanentemente{" "}
              <strong className="text-foreground">
                &quot;{deletingActivity?.title}&quot;
              </strong>
              ? Esta ação é irreversível e removerá todos os arquivos associados.
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
  );
}
