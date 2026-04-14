import type { ProfileAdapter } from "@nexusai360/profile-ui/server-helpers";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@nexusai360/core";

export class PrismaProfileAdapter implements ProfileAdapter {
  async getProfile(userId: string) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUrl: true, createdAt: true },
    });
    if (!u) return null;
    return {
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, input: { name: string }): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { name: input.name.trim() },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  }

  async verifyCurrentPassword(
    userId: string,
    currentPassword: string,
  ): Promise<boolean> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!u) return false;
    return validatePassword(currentPassword, u.password);
  }

  async updatePassword(
    userId: string,
    newHashedPassword: string,
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHashedPassword },
    });
  }

  async findUserByEmail(email: string) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return u ?? null;
  }

  async createEmailChangeToken(input: {
    userId: string;
    newEmail: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.emailChangeToken.create({
      data: {
        userId: input.userId,
        newEmail: input.newEmail,
        token: input.token,
        expiresAt: input.expiresAt,
      },
    });
  }
}
