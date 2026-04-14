import type { OpportunityStage } from "@/generated/prisma/client";

export const STAGE_ORDER: readonly OpportunityStage[] = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: "Prospecção",
  qualification: "Qualificação",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

export const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospecting: "zinc",
  qualification: "blue",
  proposal: "amber",
  negotiation: "violet",
  closed_won: "emerald",
  closed_lost: "red",
};
