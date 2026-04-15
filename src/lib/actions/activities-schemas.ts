/**
 * Schemas Zod para activities — exportados separadamente para permitir
 * importação em testes sem carregar dependências "use server" (next/cache, auth, etc.).
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validação de timezone IANA
// ---------------------------------------------------------------------------

export function isValidTimezone(tz: string): boolean {
  try {
    const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf?.("timeZone");
    if (supported) {
      return supported.includes(tz);
    }
    // Fallback: aceitar string que siga padrão IANA básico
    return /^[A-Za-z_/+\-0-9]{1,64}$/.test(tz);
  } catch {
    return /^[A-Za-z_/+\-0-9]{1,64}$/.test(tz);
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createActivitySchema = z.object({
  type: z.enum(["call", "meeting", "task", "note", "file"]),
  subjectType: z.enum(["lead", "contact", "opportunity"]),
  subjectId: z.string().uuid("subjectId deve ser UUID"),
  title: z
    .string()
    .min(1, "Título obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres"),
  description: z
    .string()
    .max(5000, "Descrição deve ter no máximo 5000 caracteres")
    .optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  timezone: z
    .string()
    .optional()
    .refine((tz) => !tz || isValidTimezone(tz), {
      message: "Timezone IANA inválida",
    }),
  durationMin: z
    .number()
    .int()
    .min(0, "Duração não pode ser negativa")
    .max(1440, "Duração máxima é 24 horas (1440 min)")
    .optional(),
  location: z
    .string()
    .max(500, "Localização deve ter no máximo 500 caracteres")
    .optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  reminderAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine((val) => !val || new Date(val) > new Date(), {
      message: "reminderAt deve ser no futuro",
    }),
  assignedTo: z.string().uuid("assignedTo deve ser UUID").optional(),
});

export const updateActivitySchema = z.object({
  type: z.enum(["call", "meeting", "task", "note", "file"]).optional(),
  title: z
    .string()
    .min(1, "Título obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .optional(),
  description: z.string().max(5000).nullish(),
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
  timezone: z
    .string()
    .nullish()
    .refine((tz) => !tz || isValidTimezone(tz), {
      message: "Timezone IANA inválida",
    }),
  durationMin: z.number().int().min(0).max(1440).nullish(),
  location: z.string().max(500).nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  reminderAt: z
    .string()
    .datetime({ offset: true })
    .nullish()
    .refine((val) => !val || new Date(val) > new Date(), {
      message: "reminderAt deve ser no futuro",
    }),
  assignedTo: z.string().uuid().nullish(),
});

// ---------------------------------------------------------------------------
// TasksFiltersSchema — filtros URL da página /tasks (Fase 32)
// ---------------------------------------------------------------------------

export const TasksFiltersSchema = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  status: z.enum(["pending", "completed", "canceled"]).optional(),
  assigneeScope: z
    .union([z.enum(["me", "all"]), z.string().uuid()])
    .optional(),
  dueWithinDays: z.enum(["overdue", "today", "7", "30"]).optional(),
});

export type TasksFilters = z.infer<typeof TasksFiltersSchema>;

export const _schemas = {
  createActivity: createActivitySchema,
  updateActivity: updateActivitySchema,
  tasksFilters: TasksFiltersSchema,
};
