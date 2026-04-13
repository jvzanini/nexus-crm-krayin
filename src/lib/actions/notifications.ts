"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function getNotifications() {
  const user = await getCurrentUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount };
}

export async function markAsRead(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  try {
    await prisma.notification.update({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Notificação não encontrada" };
  }
}

export async function markAllAsRead() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  return { success: true };
}
