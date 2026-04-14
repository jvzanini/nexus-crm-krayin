import type { Prisma } from "@/generated/prisma/client";
import type { SubjectType } from "./export";

export const ERASED_NAME_MARKER = "[DSAR ERASED]";

export function buildErasedEmail(subjectId: string): string {
  const ts = Date.now();
  const hash = subjectId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "x";
  const rand = Math.random().toString(36).slice(2, 8);
  return `erased-${ts}-${hash}${rand}@anon.local`;
}

export interface AnonymizeInput {
  subjectType: SubjectType;
  subjectId: string;
  reason?: string;
  actorId: string;
}

/**
 * Anonimiza PII do subject + atividades relacionadas + grava consent logs com source=dsar.
 * Deve rodar dentro de `prisma.$transaction`.
 */
export async function anonymizeSubject(
  tx: Prisma.TransactionClient,
  input: AnonymizeInput,
): Promise<{ ok: true }> {
  const erasedEmail = buildErasedEmail(input.subjectId);
  const reasonTag = `erased_by_dsar${input.reason ? `:${input.reason.slice(0, 400)}` : ""}`;

  if (input.subjectType === "lead") {
    await tx.lead.update({
      where: { id: input.subjectId },
      data: {
        name: ERASED_NAME_MARKER,
        email: erasedEmail,
        phone: null,
        notes: null,
        consentMarketing: false,
        consentMarketingAt: null,
        consentMarketingIpMask: null,
        consentTracking: false,
        consentTrackingAt: null,
        consentTrackingIpMask: null,
      },
    });
  } else if (input.subjectType === "contact") {
    await tx.contact.update({
      where: { id: input.subjectId },
      data: {
        firstName: ERASED_NAME_MARKER,
        lastName: "",
        email: erasedEmail,
        phone: null,
        organization: null,
        title: null,
        notes: null,
        consentMarketing: false,
        consentMarketingAt: null,
        consentMarketingIpMask: null,
        consentTracking: false,
        consentTrackingAt: null,
        consentTrackingIpMask: null,
      },
    });
  } else {
    await tx.opportunity.update({
      where: { id: input.subjectId },
      data: { notes: null },
    });
  }

  // Ativos relacionados: limpa description/location (podem ter PII)
  await tx.activity.updateMany({
    where: { subjectType: input.subjectType, subjectId: input.subjectId },
    data: { description: null, location: null },
  });

  // Grava consent log (marketing + tracking) com source=dsar — evidência de compliance
  const now = new Date();
  for (const key of ["marketing", "tracking"] as const) {
    await tx.consentLog.create({
      data: {
        subjectType: input.subjectType === "opportunity" ? "contact" : input.subjectType,
        subjectId: input.subjectId,
        consentKey: key,
        granted: false,
        grantedBy: input.actorId,
        grantedAt: now,
        source: "dsar",
        reason: reasonTag,
      },
    });
  }

  return { ok: true };
}
