import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { ACTIVITY_REMINDERS, ActivityReminderPayload } from "../queues/activity-reminders";
import { NotificationType } from "@/generated/prisma/client";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

/**
 * Inicia o Worker BullMQ para processar lembretes de atividades.
 */
export function startActivityReminderWorker(): Worker {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker(
    ACTIVITY_REMINDERS,
    async (job: Job<ActivityReminderPayload>) => {
      const { id, title, assignedTo, createdBy } = job.data;

      // Busca activity atualizada no DB
      const activity = await prisma.activity.findUnique({
        where: { id },
        select: { id: true, status: true, title: true },
      });

      if (!activity) {
        logger.info({ jobId: job.id, activityId: id }, "activity-reminder: activity não encontrada, skip");
        return;
      }

      if (activity.status !== "pending") {
        logger.info(
          { jobId: job.id, activityId: id, status: activity.status },
          "activity-reminder: status != pending, skip"
        );
        return;
      }

      const userId = assignedTo ?? createdBy;

      await createNotification({
        userId,
        type: NotificationType.activity_reminder,
        title: `Lembrete: ${title}`,
        message: `Você tem uma atividade pendente: ${title}`,
        link: `/activities/${id}`,
      });

      logger.info(
        { jobId: job.id, activityId: id, userId },
        "activity-reminder: notificação criada com sucesso"
      );
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      "activity-reminder: job falhou"
    );
  });

  return worker;
}
