import { describe, it, expect } from "vitest";
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignStatusTransitionSchema,
  CAMPAIGN_STATUSES,
} from "./marketing-campaigns-schemas";

describe("createCampaignSchema", () => {
  const base = {
    name: "Campanha Teste",
    subject: "Oferta especial",
    bodyHtml: "<p>Olá!</p>",
    mailboxId: "550e8400-e29b-41d4-a716-446655440000",
    segmentId: "550e8400-e29b-41d4-a716-446655440001",
    batchSize: 100,
  };

  it("rejeita subject vazio", () => {
    const result = createCampaignSchema.safeParse({ ...base, subject: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita bodyHtml acima de 100k chars", () => {
    const result = createCampaignSchema.safeParse({
      ...base,
      bodyHtml: "x".repeat(100_001),
    });
    expect(result.success).toBe(false);
  });

  it("rejeita batchSize acima de 1000", () => {
    const result = createCampaignSchema.safeParse({ ...base, batchSize: 1001 });
    expect(result.success).toBe(false);
  });

  it("rejeita mailboxId que não é UUID", () => {
    const result = createCampaignSchema.safeParse({ ...base, mailboxId: "nao-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejeita segmentId que não é UUID", () => {
    const result = createCampaignSchema.safeParse({ ...base, segmentId: "nao-uuid" });
    expect(result.success).toBe(false);
  });

  it("aceita campanha válida com defaults", () => {
    const result = createCampaignSchema.safeParse({
      name: "Campanha",
      subject: "Assunto",
      bodyHtml: "<p>Body</p>",
      mailboxId: "550e8400-e29b-41d4-a716-446655440000",
      segmentId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.batchSize).toBe(100);
    }
  });

  it("aceita scheduledAt como ISO datetime", () => {
    const result = createCampaignSchema.safeParse({
      ...base,
      scheduledAt: "2026-05-01T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita scheduledAt inválido", () => {
    const result = createCampaignSchema.safeParse({
      ...base,
      scheduledAt: "nao-data",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCampaignSchema", () => {
  it("aceita patch parcial sem mailboxId (omitido do schema)", () => {
    const result = updateCampaignSchema.safeParse({ name: "Novo nome" });
    expect(result.success).toBe(true);
  });

  it("não aceita mailboxId (omitido do tipo)", () => {
    // mailboxId foi omitido no updateCampaignSchema — deve ser ignorado
    const result = updateCampaignSchema.safeParse({ mailboxId: "550e8400-e29b-41d4-a716-446655440000" });
    // Zod strip unknown fields, então ainda passa mas mailboxId não fica nos dados
    if (result.success) {
      expect((result.data as any).mailboxId).toBeUndefined();
    }
  });

  it("rejeita batchSize menor que 1", () => {
    const result = updateCampaignSchema.safeParse({ batchSize: 0 });
    expect(result.success).toBe(false);
  });
});

describe("campaignStatusTransitionSchema", () => {
  it("aceita status válidos", () => {
    for (const status of ["scheduled", "sending", "paused", "canceled"] as const) {
      const result = campaignStatusTransitionSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejeita status inválido", () => {
    const result = campaignStatusTransitionSchema.safeParse({ status: "draft" });
    expect(result.success).toBe(false);
  });
});

describe("CAMPAIGN_STATUSES", () => {
  it("contém os 7 status esperados", () => {
    expect(CAMPAIGN_STATUSES).toHaveLength(7);
    expect(CAMPAIGN_STATUSES).toContain("draft");
    expect(CAMPAIGN_STATUSES).toContain("sent");
    expect(CAMPAIGN_STATUSES).toContain("canceled");
  });
});
