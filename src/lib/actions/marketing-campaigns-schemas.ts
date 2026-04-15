import { z } from "zod";

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "canceled",
  "failed",
] as const;

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(100_000),
  mailboxId: z.string().uuid(),
  segmentId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
  batchSize: z.number().int().min(1).max(1000).default(100),
});

export const updateCampaignSchema = createCampaignSchema.partial().omit({ mailboxId: true });

export const campaignStatusTransitionSchema = z.object({
  status: z.enum(["scheduled", "sending", "paused", "canceled"]),
});

/**
 * Fase 32 — filtros URL para listagem de campanhas.
 * Grupo C: busca por nome, status, range de datas (createdAt).
 */
export const CampaignsFiltersSchema = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  status: z
    .enum([
      "draft",
      "scheduled",
      "sending",
      "sent",
      "paused",
      "canceled",
      "failed",
    ])
    .optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type CampaignsFilters = z.infer<typeof CampaignsFiltersSchema>;
