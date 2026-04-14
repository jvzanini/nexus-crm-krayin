"use server";

import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hashPassword } from "@nexusai360/core";
import { sendPasswordResetEmail } from "@/lib/email";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  // Sempre retornar sucesso para não enumerar usuários
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  if (user && user.isActive) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl).catch(() => {});
  }

  return { success: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResult> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: "As senhas não coincidem" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "A senha deve ter ao menos 8 caracteres" };
  }

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!tokenRecord) return { success: false, error: "Token inválido ou expirado" };
  if (tokenRecord.usedAt) return { success: false, error: "Token já utilizado" };
  if (tokenRecord.expiresAt < new Date()) return { success: false, error: "Token expirado" };

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
