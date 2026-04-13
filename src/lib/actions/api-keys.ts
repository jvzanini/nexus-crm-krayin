"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";

interface CreateApiKeyInput {
  companyId: string;
  name: string;
  scopes?: string[];
  allowedIps?: string[];
  expiresAt?: Date;
}

export async function createApiKey(input: CreateApiKeyInput) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes ?? [],
      allowedIps: input.allowedIps ?? [],
      expiresAt: input.expiresAt ?? null,
      createdBy: user.id,
    },
  });

  return { success: true, apiKey: { ...apiKey, rawKey } };
}

export async function listApiKeys(companyId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  const keys = await prisma.apiKey.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      allowedIps: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, keys };
}

export async function revokeApiKey(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  return { success: true };
}
