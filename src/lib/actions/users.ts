"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PLATFORM_ROLE_HIERARCHY } from "@/lib/constants/roles";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface UserItem {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  highestRole: string;
  isActive: boolean;
  companiesCount: number;
  createdAt: Date;
  canEdit: boolean;
  canDelete: boolean;
  avatarUrl: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Gerente",
  viewer: "Visualizador",
};

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  platformRole: z.enum(["super_admin", "admin", "manager", "viewer"]),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  platformRole: z
    .enum(["super_admin", "admin", "manager", "viewer"])
    .optional(),
  isActive: z.boolean().optional(),
});

export async function getUsers(): Promise<ActionResult<UserItem[]>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  const myLevel = PLATFORM_ROLE_HIERARCHY[currentUser.platformRole] ?? 0;

  // Super admin vê todos
  let whereClause = {};
  if (!currentUser.isSuperAdmin) {
    // Admin vê manager/viewer, manager/viewer não acessam /users
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
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      isSuperAdmin: true,
      isActive: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data: UserItem[] = users.map((u) => {
    const targetLevel = PLATFORM_ROLE_HIERARCHY[u.platformRole] ?? 0;
    const isTargetSuperAdmin = u.platformRole === "super_admin";

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      platformRole: u.platformRole,
      highestRole: ROLE_LABELS[u.platformRole] ?? "Usuário",
      isActive: u.isActive,
      companiesCount: u._count.memberships,
      createdAt: u.createdAt,
      avatarUrl: u.avatarUrl,
      canEdit:
        u.id !== currentUser.id &&
        (currentUser.isSuperAdmin || (!isTargetSuperAdmin && targetLevel < myLevel)),
      canDelete:
        u.id !== currentUser.id &&
        !isTargetSuperAdmin &&
        (currentUser.isSuperAdmin || targetLevel < myLevel),
    };
  });

  return { success: true, data };
}

export async function createUser(
  input: z.infer<typeof createUserSchema>
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos" };

  const myLevel = PLATFORM_ROLE_HIERARCHY[currentUser.platformRole] ?? 0;
  const targetLevel =
    PLATFORM_ROLE_HIERARCHY[parsed.data.platformRole] ?? 0;

  if (targetLevel >= myLevel && !currentUser.isSuperAdmin) {
    return { success: false, error: "Sem permissão para criar usuário com este nível" };
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
  }

  revalidatePath("/users");
  return { success: true, data: { id: user.id } };
}

export async function updateUser(
  userId: string,
  input: z.infer<typeof updateUserSchema>
): Promise<ActionResult> {
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

  // Apenas super_admin pode editar super_admin; admin pode editar abaixo
  if (targetLevel >= myLevel && !currentUser.isSuperAdmin) {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.user.update({
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
  });

  revalidatePath("/users");
  return { success: true };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };
  if (!currentUser.isSuperAdmin) return { success: false, error: "Sem permissão" };
  if (userId === currentUser.id) return { success: false, error: "Não pode excluir a si mesmo" };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, email: `deleted_${userId}@nexus.deleted` },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function toggleUserRole(
  userId: string,
  newRole: string
): Promise<ActionResult> {
  return updateUser(userId, { platformRole: newRole as any });
}
