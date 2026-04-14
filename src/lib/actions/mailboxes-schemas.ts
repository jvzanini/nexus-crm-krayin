import { z } from "zod";

/**
 * Schema de validação para `connectImapSmtpAction`.
 * Mantido em módulo separado (não em `mailboxes.ts`) porque `"use server"`
 * só aceita exports de funções async — runtime const como Zod schema quebra
 * o build do Next (turbopack: "module has no exports at all").
 */
export const connectImapSmtpSchema = z.object({
  emailAddress: z.string().email("E-mail inválido"),
  displayName: z.string().max(200, "Nome deve ter no máximo 200 caracteres").optional(),
  imapHost: z
    .string()
    .min(1, "Host IMAP obrigatório")
    .max(255, "Host IMAP deve ter no máximo 255 caracteres"),
  imapPort: z
    .number()
    .int("Porta deve ser inteiro")
    .min(1, "Porta mínima: 1")
    .max(65535, "Porta máxima: 65535"),
  smtpHost: z
    .string()
    .min(1, "Host SMTP obrigatório")
    .max(255, "Host SMTP deve ter no máximo 255 caracteres"),
  smtpPort: z
    .number()
    .int("Porta deve ser inteiro")
    .min(1, "Porta mínima: 1")
    .max(65535, "Porta máxima: 65535"),
  authUsername: z
    .string()
    .min(1, "Usuário obrigatório")
    .max(255, "Usuário deve ter no máximo 255 caracteres"),
  authPassword: z
    .string()
    .min(1, "Senha obrigatória")
    .max(500, "Senha deve ter no máximo 500 caracteres"),
});
