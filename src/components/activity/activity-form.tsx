"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Button,
  Input,
} from "@nexusai360/design-system";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createActivity,
  updateActivity,
  uploadFile,
  getAssignableUsers,
} from "@/lib/actions/activities";
import type {
  ActivityItem,
  ActivityType,
  AssignableUser,
} from "@/lib/actions/activities";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityFormProps {
  type: ActivityType;
  initial?: ActivityItem;
  subjectType: "lead" | "contact" | "opportunity";
  subjectId: string;
  mode: "create" | "edit";
  onSaved: () => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

// ---------------------------------------------------------------------------
// Labels por type
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ActivityType, string> = {
  call: "Ligação",
  meeting: "Reunião",
  task: "Tarefa",
  note: "Nota",
  file: "Arquivo",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDatetimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  // Formato: yyyy-MM-ddTHH:mm (hora local do browser)
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Converte valor de input datetime-local (sem offset) para ISO 8601 com offset local.
 * Necessário porque o schema Zod usa `z.string().datetime({ offset: true })`.
 */
function toISOWithOffset(datetimeLocal: string): string | undefined {
  if (!datetimeLocal) return undefined;
  // `new Date(datetimeLocal)` interpreta como UTC se não houver offset; precisamos de local.
  // Tratamos como horário local adicionando segundos e chamando toISOString → UTC, então
  // convertemos para ISO com offset local manualmente.
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
// Componente principal
// ---------------------------------------------------------------------------

export function ActivityForm({
  type,
  initial,
  subjectType,
  subjectId,
  mode,
  onSaved,
  open,
  onOpenChange,
}: ActivityFormProps) {
  // --- Campos compartilhados ---
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");

  // --- Call / Meeting ---
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeLocal(initial?.scheduledAt)
  );
  const [durationMin, setDurationMin] = useState(
    initial?.durationMin != null ? String(initial.durationMin) : ""
  );
  const [timezone, setTimezone] = useState(
    initial?.timezone ??
      (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "")
  );

  // --- Meeting ---
  const [location, setLocation] = useState(initial?.location ?? "");

  // --- Task ---
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt));
  const [reminderAt, setReminderAt] = useState(
    toDatetimeLocal(initial?.reminderAt)
  );

  // --- File ---
  const [fileInput, setFileInput] = useState<File | null>(null);

  // --- Users list ---
  const [users, setUsers] = useState<AssignableUser[]>([]);

  // --- Transition ---
  const [saving, startSaving] = useTransition();

  // ---------------------------------------------------------------------------
  // Carregar usuários
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    getAssignableUsers().then((res) => {
      if (res.success && res.data) setUsers(res.data);
    });
  }, [open]);

  // ---------------------------------------------------------------------------
  // Reset ao abrir em mode create
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setScheduledAt("");
      setDurationMin("");
      setTimezone(
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : ""
      );
      setLocation("");
      setDueAt("");
      setReminderAt("");
      setFileInput(null);
    } else if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setAssignedTo(initial.assignedTo ?? "");
      setScheduledAt(toDatetimeLocal(initial.scheduledAt));
      setDurationMin(initial.durationMin != null ? String(initial.durationMin) : "");
      setTimezone(initial.timezone ?? "");
      setLocation(initial.location ?? "");
      setDueAt(toDatetimeLocal(initial.dueAt));
      setReminderAt(toDatetimeLocal(initial.reminderAt));
    }
  }, [open, mode, initial]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    startSaving(async () => {
      const payload = {
        type: type as string,
        subjectType,
        subjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo || undefined,
        scheduledAt: toISOWithOffset(scheduledAt),
        timezone: timezone || undefined,
        durationMin: durationMin ? Number(durationMin) : undefined,
        location: location.trim() || undefined,
        dueAt: toISOWithOffset(dueAt),
        reminderAt: toISOWithOffset(reminderAt),
      };

      if (mode === "create") {
        const result = await createActivity(payload);
        if (!result.success) {
          toast.error(result.error ?? "Erro ao criar atividade");
          return;
        }

        // Upload de arquivo após criação (se type=file)
        if (type === "file" && fileInput && result.data) {
          const buffer = await fileInput.arrayBuffer();
          const bytes = Buffer.from(buffer);
          const uploadResult = await uploadFile(result.data.id, {
            filename: fileInput.name,
            mime: fileInput.type,
            bytes,
          });
          if (!uploadResult.success) {
            // Atividade criada mas arquivo falhou
            toast.error(`Atividade criada, mas erro no upload: ${uploadResult.error}`);
          } else {
            toast.success("Atividade e arquivo criados com sucesso");
          }
        } else {
          toast.success(`${TYPE_LABELS[type]} criada com sucesso`);
        }
      } else {
        if (!initial) return;
        const result = await updateActivity(initial.id, payload);
        if (!result.success) {
          toast.error(result.error ?? "Erro ao atualizar atividade");
          return;
        }
        toast.success(`${TYPE_LABELS[type]} atualizada com sucesso`);
      }

      onSaved();
      onOpenChange(false);
    });
  }

  // ---------------------------------------------------------------------------
  // Campos por tipo
  // ---------------------------------------------------------------------------

  const inputClass =
    "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground";
  const labelClass = "block text-sm font-medium text-foreground/80 mb-1.5";
  const textareaClass =
    "flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none";

  function renderFields() {
    return (
      <div className="space-y-4">
        {/* Título — sempre */}
        <div>
          <label className={labelClass}>
            Título *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Título da ${TYPE_LABELS[type].toLowerCase()}`}
            className={inputClass}
            disabled={saving}
          />
        </div>

        {/* Call / Meeting: scheduledAt + durationMin */}
        {(type === "call" || type === "meeting") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Data e hora
              </label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={inputClass}
                disabled={saving}
              />
            </div>
            <div>
              <label className={labelClass}>
                Duração (min)
              </label>
              <Input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="Ex: 30"
                min={1}
                className={inputClass}
                disabled={saving}
              />
            </div>
          </div>
        )}

        {/* Meeting: timezone + location */}
        {type === "meeting" && (
          <>
            <div>
              <label className={labelClass}>
                Fuso horário
              </label>
              {/* TODO T7: extract to i18n key activities.form.meeting.timezone */}
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Ex: America/Sao_Paulo"
                className={inputClass}
                disabled={saving}
              />
            </div>
            <div>
              <label className={labelClass}>
                Local / URL
              </label>
              {/* TODO T7: extract to i18n key activities.form.meeting.location */}
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Endereço ou link da reunião"
                className={inputClass}
                disabled={saving}
              />
            </div>
          </>
        )}

        {/* Task: dueAt + reminderAt */}
        {type === "task" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Prazo
              </label>
              {/* TODO T7: extract to i18n key activities.form.task.dueAt */}
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className={inputClass}
                disabled={saving}
              />
            </div>
            <div>
              <label className={labelClass}>
                Lembrete (opcional)
              </label>
              {/* TODO T7: extract to i18n key activities.form.task.reminderAt */}
              <Input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className={inputClass}
                disabled={saving}
              />
            </div>
          </div>
        )}

        {/* Descrição — call, meeting, task, note */}
        {(type === "call" || type === "meeting" || type === "task" || type === "note") && (
          <div>
            <label className={labelClass}>
              {type === "note" ? "Conteúdo" : "Observações"}
            </label>
            {/* TODO T7: extract to i18n key activities.form.description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "note" ? "Escreva a nota aqui..." : "Observações adicionais"}
              rows={type === "note" ? 5 : 3}
              disabled={saving}
              className={textareaClass}
            />
          </div>
        )}

        {/* File: input de arquivo */}
        {type === "file" && (
          <div>
            <label className={labelClass}>
              Arquivo
            </label>
            {/* TODO T7: extract to i18n key activities.form.file.upload */}
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <input
                type="file"
                onChange={(e) => setFileInput(e.target.files?.[0] ?? null)}
                disabled={saving}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-violet-600/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-400 hover:file:bg-violet-600/20 cursor-pointer"
              />
              {fileInput && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {fileInput.name} ({(fileInput.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Responsável — todos os tipos */}
        <div>
          <label className={labelClass}>
            Responsável
          </label>
          {/* TODO T7: extract to i18n key activities.form.assignedTo */}
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            disabled={saving}
            className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— Sem responsável —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isCreate = mode === "create";
  const dialogTitle = isCreate
    ? `Nova ${TYPE_LABELS[type].toLowerCase()}`
    : `Editar ${TYPE_LABELS[type].toLowerCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle>
            {/* TODO T7: extract to i18n key activities.form.title */}
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? `Registre uma nova ${TYPE_LABELS[type].toLowerCase()}`
              : `Atualize os dados da ${TYPE_LABELS[type].toLowerCase()}`}
          </DialogDescription>
        </DialogHeader>

        {renderFields()}

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {/* TODO T7: extract to i18n key activities.form.submit */}
            {isCreate ? `Criar ${TYPE_LABELS[type].toLowerCase()}` : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
