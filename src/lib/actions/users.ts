"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PLATFORM_ROLE_HIERARCHY } from "@/lib/constants/roles";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import {
  createUserSchema,
  updateUserSchema,
  assertCanCreateUser,
  assertCanUpdateUser,
  assertCanDeleteUser,
  PermissionDeniedError,
} from "@nexusai360/users-ui/server-helpers";
import type { UserItem } from "@nexusai360/users-ui/server-helpers";
import type { PlatformRole } from "@nexusai360/types";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Gerente",
  viewer: "Visualizador",
};

function toUserItem(
  u: {
    id: string;
    name: string;
    email: string;
    platformRole: string;
    isActive: boolean;
    avatarUrl: string | null;
    createdAt: Date;
    _count: { memberships: number };
  },
  currentUser: { id: string; isSuperAdmin: boolean; platformRole: string }
): UserItem {
  const myLevel = PLATFORM_ROLE_HIERARCHY[currentUser.platformRole] ?? 0;
  const targetLevel = PLATFORM_ROLE_HIERARCHY[u.platformRole] ?? 0;
  const isTargetSuperAdmin = u.platformRole === "super_admin";

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    platformRole: u.platformRole as PlatformRole,
    highestRole: ROLE_LABELS[u.platformRole] ?? "Usuário",
    isActive: u.isActive,
    companiesCount: u._count.memberships,
    createdAt: u.createdAt,
    avatarUrl: u.avatarUrl,
    canEdit:
      u.id !== currentUser.id &&
      (currentUser.isSuperAdmin ||
        (!isTargetSuperAdmin && targetLevel < myLevel)),
    canDelete:
      u.id !== currentUser.id &&
      !isTargetSuperAdmin &&
      (currentUser.isSuperAdmin || targetLevel < myLevel),
  };
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  platformRole: true,
  isSuperAdmin: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
  _count: { select: { memberships: true } },
} as const;

export async function getUsers(): Promise<ActionResult<UserItem[]>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  let whereClause = {};
  if (!currentUser.isSuperAdmin) {
    if (currentUser.platformRole === "admin") {
      whereClause = {
        platformRole: { in: ["manager", "viewer"] },
      };
    } else {
      return { success: false, error: "Sem permissão" };
    }
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
  });

  const data: UserItem[] = users.map((u) => toUserItem(u, currentUser));

  return { success: true, data };
}

export async function createUser(
  input: unknown
): Promise<ActionResult<UserItem>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  try {
    assertCanCreateUser(currentUser as any);
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { success: false, error: e.message };
    }
    throw e;
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos" };

  const myLevel = PLATFORM_ROLE_HIERARCHY[currentUser.platformRole] ?? 0;
  const targetLevel = PLATFORM_ROLE_HIERARCHY[parsed.data.platformRole] ?? 0;

  if (targetLevel >= myLevel && !currentUser.isSuperAdmin) {
    return {
      success: false,
      error: "Sem permissão para criar usuário com este nível",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { success: false, error: "E-mail já cadastrado" };

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      platformRole: parsed.data.platformRole as any,
      isSuperAdmin: parsed.data.platformRole === "super_admin",
      invitedById: currentUser.id,
    },
    select: USER_SELECT,
  });

  // Se super_admin, auto-vincular a todas as empresas
  if (parsed.data.platformRole === "super_admin") {
    const companies = await prisma.company.findMany({ select: { id: true } });
    if (companies.length > 0) {
      await prisma.userCompanyMembership.createMany({
        data: companies.map((c) => ({
          userId: user.id,
          companyId: c.id,
          role: "company_admin" as any,
        })),
        skipDuplicates: true,
      });
    }
    // Re-fetch para pegar o count atualizado
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: USER_SELECT,
    });
    revalidatePath("/users");
    return { success: true, data: toUserItem(updated, currentUser) };
  }

  revalidatePath("/users");
  return { success: true, data: toUserItem(user, currentUser) };
}

export async function updateUser(
  userId: string,
  input: unknown
): Promise<ActionResult<UserItem>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos" };

  const myLevel = PLATFORM_ROLE_HIERARCHY[currentUser.platformRole] ?? 0;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, isSuperAdmin: true },
  });
  if (!target) return { success: false, error: "Usuário não encontrado" };

  const targetLevel = PLATFORM_ROLE_HIERARCHY[target.platformRole] ?? 0;

  try {
    assertCanUpdateUser(currentUser as any, {
      id: userId,
      platformRole: target.platformRole as PlatformRole,
    });
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { success: false, error: e.message };
    }
  }

  // Fallback manual check
  if (targetLevel >= myLevel && !currentUser.isSuperAdmin) {
    return { success: false, error: "Sem permissão" };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.platformRole && {
        platformRole: parsed.data.platformRole as any,
        isSuperAdmin: parsed.data.platformRole === "super_admin",
      }),
      ...(parsed.data.isActive !== undefined && {
        isActive: parsed.data.isActive,
      }),
    },
    select: USER_SELECT,
  });

  revalidatePath("/users");
  return { success: true, data: toUserItem(updated, currentUser) };
}

export async function deleteUser(userId: string): Promise<ActionResult<void>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  try {
    assertCanDeleteUser(currentUser as any, {
      id: userId,
      platformRole: "viewer",
    });
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { success: false, error: e.message };
    }
  }

  if (!currentUser.isSuperAdmin)
    return { success: false, error: "Sem permissão" };
  if (userId === currentUser.id)
    return { success: false, error: "Não pode excluir a si mesmo" };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, email: `deleted_${userId}@nexus.deleted` },
  });

  revalidatePath("/users");
  return { success: true, data: undefined };
}

export async function toggleUserRole(
  userId: string,
  newRole: string
): Promise<ActionResult<UserItem>> {
  return updateUser(userId, { platformRole: newRole as any });
}
