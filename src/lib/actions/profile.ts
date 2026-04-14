"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import {
  updateProfileSchema,
  changePasswordSchema,
  requestEmailChangeSchema,
  type ActionResult,
} from "@nexusai360/profile-ui/server-helpers";
import { hashPassword } from "@nexusai360/core";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { profileAdapter } from "@/lib/adapters/profile";
import { sendEmailVerificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
      };
    }
    await profileAdapter.updateProfile(user.id, parsed.data);
    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.update.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function updateAvatarAction(avatarUrl: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    if (typeof avatarUrl !== "string" || !avatarUrl) {
      return { success: false, error: "invalid_input" };
    }
    await profileAdapter.updateAvatar(user.id, avatarUrl);
    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.avatar.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
      };
    }
    const ok = await profileAdapter.verifyCurrentPassword(
      user.id,
      parsed.data.currentPassword,
    );
    if (!ok) return { success: false, error: "Senha atual incorreta" };
    const hashed = await hashPassword(parsed.data.newPassword);
    await profileAdapter.updatePassword(user.id, hashed);
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.password.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function requestEmailChangeAction(
  newEmail: string,
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    const parsed = requestEmailChangeSchema.safeParse({ newEmail });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
      };
    }
    const existing = await profileAdapter.findUserByEmail(parsed.data.newEmail);
    if (existing) return { success: false, error: "E-mail já cadastrado" };
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await profileAdapter.createEmailChangeToken({
      userId: user.id,
      newEmail: parsed.data.newEmail,
      token,
      expiresAt,
    });
    const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
    await sendEmailVerificationEmail(parsed.data.newEmail, verifyUrl);
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.email.request.failed");
    return { success: false, error: "internal_error" };
  }
}

// Mantido intacto — usado pela rota /verify-email
export async function verifyEmailChange(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const tokenRecord = await prisma.emailChangeToken.findUnique({
    where: { token },
  });
  if (!tokenRecord) return { success: false, error: "Token inválido" };
  if (tokenRecord.usedAt) return { success: false, error: "Token já utilizado" };
  if (tokenRecord.expiresAt < new Date())
    return { success: false, error: "Token expirado" };

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
