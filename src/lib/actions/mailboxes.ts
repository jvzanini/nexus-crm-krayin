"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { encryptMailboxTokens } from "@/lib/email/tokens";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MailboxItem {
  id: string;
  provider: string;
  emailAddress: string;
  displayName: string | null;
  isPrimary: boolean;
  isActive: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  accessTokenExpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Schema IMAP/SMTP mora em `./mailboxes-schemas.ts` (use server só aceita funções async).
import { connectImapSmtpSchema } from "./mailboxes-schemas";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Retorna o companyId ativo do usuário logado. */
async function resolveActiveCompanyId(userId: string): Promise<string | null> {
  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });
  return membership?.companyId ?? null;
}

function handleError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, "mailboxes.action.failed");
  return { success: false, error: fallback };
}

function serializeMailbox(m: {
  id: string;
  provider: string;
  emailAddress: string;
  displayName: string | null;
  isPrimary: boolean;
  isActive: boolean;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  accessTokenExpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MailboxItem {
  return {
    id: m.id,
    provider: m.provider,
    emailAddress: m.emailAddress,
    displayName: m.displayName,
    isPrimary: m.isPrimary,
    isActive: m.isActive,
    hasAccessToken: !!m.accessTokenEnc,
    hasRefreshToken: !!m.refreshTokenEnc,
    accessTokenExpAt: m.accessTokenExpAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Stub de teste IMAP — Fase 7b T3/T4 irão popular com imapflow real
// ---------------------------------------------------------------------------

async function testImapConnection(_params: {
  host: string;
  port: number;
  user: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  // TODO Fase 7b T3: usar imapflow real aqui.
  // Atualmente dry-run — aceita credenciais sem validar.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function listMailboxes(): Promise<ActionResult<MailboxItem[]>> {
  try {
    const user = await requirePermission("email:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const mailboxes = await prisma.mailbox.findMany({
      where: { userId: user.id, companyId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        provider: true,
        emailAddress: true,
        displayName: true,
        isPrimary: true,
        isActive: true,
        accessTokenEnc: true,
        refreshTokenEnc: true,
        accessTokenExpAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: mailboxes.map(serializeMailbox) };
  } catch (err) {
    return handleError(err, "Erro ao listar mailboxes");
  }
}

export async function setPrimaryMailbox(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("email:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    // Valida que mailbox pertence ao user + company
    const mailbox = await prisma.mailbox.findUnique({
      where: { id },
      select: { id: true, userId: true, companyId: true },
    });
    if (!mailbox || mailbox.userId !== user.id || mailbox.companyId !== companyId) {
      return { success: false, error: "Mailbox não encontrada" };
    }

    await prisma.$transaction([
      // Remove primary de todos os mailboxes do user nesta empresa
      prisma.mailbox.updateMany({
        where: { userId: user.id, companyId, isPrimary: true },
        data: { isPrimary: false },
      }),
      // Define o mailbox selecionado como primary
      prisma.mailbox.update({
        where: { id },
        data: { isPrimary: true },
      }),
    ]);

    revalidatePath("/settings/mailboxes");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao definir mailbox primária");
  }
}

export async function disconnectMailbox(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("email:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    // Valida ownership + tenant
    const mailbox = await prisma.mailbox.findUnique({
      where: { id },
      select: { id: true, userId: true, companyId: true },
    });
    if (!mailbox || mailbox.userId !== user.id || mailbox.companyId !== companyId) {
      return { success: false, error: "Mailbox não encontrada" };
    }

    await prisma.mailbox.update({
      where: { id },
      data: {
        isActive: false,
        accessTokenEnc: null,
        refreshTokenEnc: null,
        authPasswordEnc: null,
      },
    });

    revalidatePath("/settings/mailboxes");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao desconectar mailbox");
  }
}

export async function connectImapSmtpAction(
  input: z.infer<typeof connectImapSmtpSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("email:connect");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const parsed = connectImapSmtpSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const {
      emailAddress,
      displayName,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      authUsername,
      authPassword,
    } = parsed.data;

    // 1. Testa conexão IMAP via stub
    const imapTest = await testImapConnection({
      host: imapHost,
      port: imapPort,
      user: authUsername,
      password: authPassword,
    });

    if (!imapTest.ok) {
      return {
        success: false,
        error: imapTest.error ?? "Falha ao conectar ao servidor IMAP",
      };
    }

    // 2. Encripta password
    const { authPasswordEnc } = encryptMailboxTokens({ authPassword });

    // 3. Upsert por unique (userId, emailAddress)
    const mailbox = await prisma.mailbox.upsert({
      where: { uq_mailbox_user_addr: { userId: user.id, emailAddress } },
      create: {
        companyId,
        userId: user.id,
        provider: "imap_smtp",
        emailAddress,
        displayName: displayName ?? null,
        isPrimary: false,
        isActive: true,
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        authUsername,
        authPasswordEnc,
      },
      update: {
        displayName: displayName ?? null,
        isActive: true,
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        authUsername,
        authPasswordEnc,
      },
      select: { id: true },
    });

    // 4. Revalida
    revalidatePath("/settings/mailboxes");

    // 5. Retorna
    return { success: true, data: { id: mailbox.id } };
  } catch (err) {
    return handleError(err, "Erro ao conectar mailbox IMAP/SMTP");
  }
}
