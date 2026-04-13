"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function getSetting(key: string) {
  const setting = await prisma.globalSettings.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: unknown) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  await prisma.globalSettings.upsert({
    where: { key },
    update: { value: value as any, updatedBy: user.id },
    create: { key, value: value as any, updatedBy: user.id },
  });

  return { success: true };
}

export async function getAllSettings() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  const settings = await prisma.globalSettings.findMany({
    orderBy: { key: "asc" },
  });

  return {
    success: true,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  };
}
