"use server";

import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";

interface CreateApiKeyInput {
  companyId: string;
  name: string;
  scopes?: string[];
  allowedIps?: string[];
  expiresAt?: Date;
}

export async function createApiKey(input: CreateApiKeyInput) {
  try {
    const user = await requirePermission("api-keys:manage");

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
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
}

export async function listApiKeys(companyId: string) {
  try {
    await requirePermission("api-keys:manage");

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
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
}

export async function revokeApiKey(id: string) {
  try {
    await requirePermission("api-keys:manage");

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
}
