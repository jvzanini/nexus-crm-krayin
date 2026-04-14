// Helpers para criação de notificações
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  companyId?: string;
}

/**
 * Cria uma notificação para um usuário. Fire-and-forget — não lança exceção.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        companyId: input.companyId ?? null,
        type: input.type,
        title: input.title,
        message: input.message ?? "",
        link: input.link ?? "",
        channelsSent: ["in_app"],
      },
    });
  } catch (err) {
    logger.error({ err, userId: input.userId, type: input.type }, "notifications.create.failed");
  }
}
