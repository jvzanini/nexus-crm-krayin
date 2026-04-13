"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { sendEmailVerificationEmail } from "@/lib/email";
import { z } from "zod";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function updateProfile(input: {
  name: string;
}): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  if (!input.name || input.name.trim().length < 2) {
    return { success: false, error: "Nome deve ter ao menos 2 caracteres" };
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { name: input.name.trim() },
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function updateAvatar(avatarUrl: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { avatarUrl },
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  if (input.newPassword !== input.confirmPassword) {
    return { success: false, error: "As senhas não coincidem" };
  }

  if (input.newPassword.length < 8) {
    return { success: false, error: "A nova senha deve ter ao menos 8 caracteres" };
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { password: true },
  });
  if (!user) return { success: false, error: "Usuário não encontrado" };

  const valid = await bcrypt.compare(input.currentPassword, user.password);
  if (!valid) return { success: false, error: "Senha atual incorreta" };

  const hashed = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({
    where: { id: currentUser.id },
    data: { password: hashed },
  });

  return { success: true };
}

export async function requestEmailChange(newEmail: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) return { success: false, error: "E-mail já cadastrado" };

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.emailChangeToken.create({
    data: {
      userId: currentUser.id,
      newEmail,
      token,
      expiresAt,
    },
  });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  await sendEmailVerificationEmail(newEmail, verifyUrl);

  return { success: true };
}

export async function verifyEmailChange(token: string): Promise<ActionResult> {
  const tokenRecord = await prisma.emailChangeToken.findUnique({
    where: { token },
  });

  if (!tokenRecord) return { success: false, error: "Token inválido" };
  if (tokenRecord.usedAt) return { success: false, error: "Token já utilizado" };
  if (tokenRecord.expiresAt < new Date()) return { success: false, error: "Token expirado" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { email: tokenRecord.newEmail },
    }),
    prisma.emailChangeToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}

export async function getProfile(): Promise<ActionResult<{
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { name: true, email: true, avatarUrl: true, createdAt: true },
  });

  if (!user) return { success: false, error: "Usuário não encontrado" };

  return {
    success: true,
    data: {
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  };
}
