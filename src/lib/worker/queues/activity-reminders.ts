import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const ACTIVITY_REMINDERS = "activity-reminders";

export interface ActivityReminderPayload {
  id: string;
  reminderAt: Date;
  assignedTo: string | null;
  createdBy: string;
  subjectType: string;
  subjectId: string;
  title: string;
}

export const activityReminderQueue = new Queue(ACTIVITY_REMINDERS, {
  connection: redis,
});

/**
 * Agenda um lembrete para a activity.
 * Retorna o jobId criado.
 */
export async function scheduleReminder(
  activity: ActivityReminderPayload
): Promise<string | null> {
  const now = Date.now();
  const delay = Math.max(0, new Date(activity.reminderAt).getTime() - now);

  const job = await activityReminderQueue.add(
    "reminder",
    {
      id: activity.id,
      reminderAt: activity.reminderAt,
      assignedTo: activity.assignedTo,
      createdBy: activity.createdBy,
      subjectType: activity.subjectType,
      subjectId: activity.subjectId,
      title: activity.title,
    },
    {
      delay,
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );

  return job.id ?? null;
}

/**
 * Cancela um lembrete pelo jobId. Null-safe — não lança se jobId for nulo.
 */
export async function cancelReminder(
  jobId: string | null | undefined
): Promise<void> {
  if (!jobId) return;

  const job = await activityReminderQueue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}
