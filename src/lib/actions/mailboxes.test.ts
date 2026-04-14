import { describe, it, expect } from "vitest";
import { connectImapSmtpSchema } from "./mailboxes-schemas";

describe("connectImapSmtpSchema — validação Zod", () => {
  const validInput = {
    emailAddress: "user@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    authUsername: "user@example.com",
    authPassword: "s3cr3t",
  };

  it("rejeita emailAddress inválido", () => {
    const result = connectImapSmtpSchema.safeParse({
      ...validInput,
      emailAddress: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita porta 0", () => {
    const result = connectImapSmtpSchema.safeParse({
      ...validInput,
      imapPort: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita porta 65536", () => {
    const result = connectImapSmtpSchema.safeParse({
      ...validInput,
      smtpPort: 65536,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita host vazio", () => {
    const result = connectImapSmtpSchema.safeParse({
      ...validInput,
      imapHost: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita password vazio", () => {
    const result = connectImapSmtpSchema.safeParse({
      ...validInput,
      authPassword: "",
    });
    expect(result.success).toBe(false);
  });

  it("aceita input válido completo", () => {
    const result = connectImapSmtpSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});
