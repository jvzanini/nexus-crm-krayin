import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { activityReminderQueue, scheduleReminder } from "./queues/activity-reminders";

/**
 * Reenfileira lembretes de atividades pendentes ao boot do worker.
 * Garante que nenhum lembrete seja perdido após reinicialização.
 */
export async function reenqueuePendingReminders(): Promise<void> {
  const activities = await prisma.activity.findMany({
    where: {
      status: "pending",
      reminderAt: { gt: new Date() },
    },
    select: {
      id: true,
      reminderAt: true,
      reminderJobId: true,
      assignedTo: true,
      createdBy: true,
      subjectType: true,
      subjectId: true,
      title: true,
    },
  });

  let scheduled = 0;
  let skipped = 0;

  for (const activity of activities) {
    if (activity.reminderAt === null) continue;

    // Verifica se job ainda existe na fila
    if (activity.reminderJobId) {
      const existingJob = await activityReminderQueue.getJob(activity.reminderJobId);
      if (existingJob) {
        skipped++;
        continue;
      }
    }

    // Agenda novo job
    const newJobId = await scheduleReminder({
      id: activity.id,
      reminderAt: activity.reminderAt,
      assignedTo: activity.assignedTo,
      createdBy: activity.createdBy,
      subjectType: activity.subjectType,
      subjectId: activity.subjectId,
      title: activity.title,
    });

    if (newJobId) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { reminderJobId: newJobId },
      });
      scheduled++;
    }
  }

  logger.info(
    { scheduled, skipped, total: activities.length },
    "boot: reenqueue de lembretes de atividades concluído"
  );
}
