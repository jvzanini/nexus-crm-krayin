import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    emailChangeToken: { create: vi.fn() },
  },
}));
vi.mock("@nexusai360/core", () => ({
  validatePassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { validatePassword } from "@nexusai360/core";
import { PrismaProfileAdapter } from "../prisma-profile-adapter";

describe("PrismaProfileAdapter", () => {
  const adapter = new PrismaProfileAdapter();
  beforeEach(() => vi.clearAllMocks());

  it("getProfile retorna DTO com createdAt ISO", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Jo",
      email: "j@x.io",
      avatarUrl: null,
      createdAt,
    });
    const dto = await adapter.getProfile("u1");
    expect(dto).toEqual({
      name: "Jo",
      email: "j@x.io",
      avatarUrl: null,
      createdAt: createdAt.toISOString(),
    });
  });

  it("getProfile retorna null quando usuário não existe", async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await adapter.getProfile("nope")).toBeNull();
  });

  it("updateProfile trimma name", async () => {
    (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await adapter.updateProfile("u1", { name: "  Maria  " });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Maria" },
    });
  });

  it("verifyCurrentPassword false quando user não existe", async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await adapter.verifyCurrentPassword("u1", "x")).toBe(false);
  });

  it("verifyCurrentPassword delega a validatePassword quando user existe", async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      password: "hash",
    });
    (validatePassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    expect(await adapter.verifyCurrentPassword("u1", "plain")).toBe(true);
    expect(validatePassword).toHaveBeenCalledWith("plain", "hash");
  });
});
