import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";

import {
  CONSENT_KEYS,
  type ActiveConsent,
  type ActiveConsentEntry,
  type ConsentKey,
  type ConsentSource,
  type RecordConsentInput,
  type SubjectType,
} from "./types";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

function subjectDelegate(tx: Tx, subjectType: SubjectType) {
  return subjectType === "lead" ? tx.lead : tx.contact;
}

function readDelegate(db: Db, subjectType: SubjectType) {
  return subjectType === "lead" ? db.lead : db.contact;
}

function denormalizedUpdate(
  key: ConsentKey,
  granted: boolean,
  ipMask: string | null | undefined,
  at: Date,
) {
  if (key === "marketing") {
    return {
      consentMarketing: granted,
      consentMarketingAt: granted ? at : null,
      consentMarketingIpMask: granted ? (ipMask ?? null) : null,
    };
  }
  return {
    consentTracking: granted,
    consentTrackingAt: granted ? at : null,
    consentTrackingIpMask: granted ? (ipMask ?? null) : null,
  };
}

async function latestLog(
  db: Db,
  subjectType: SubjectType,
  subjectId: string,
  consentKey: ConsentKey,
) {
  return db.consentLog.findFirst({
    where: { subjectType, subjectId, consentKey },
    orderBy: { grantedAt: "desc" },
  });
}

/**
 * Grava diffs em consent_logs e atualiza denormalizados no subject.
 * Idempotente: se estado atual == último log, não grava.
 */
export async function recordConsent(
  tx: Tx,
  input: RecordConsentInput,
): Promise<{ changes: ConsentKey[] }> {
  const now = new Date();
  const changes: ConsentKey[] = [];

  const truncUa = input.userAgent ? input.userAgent.slice(0, 200) : null;
  const sanitizedReason = input.reason
    ? input.reason.replace(/<[^>]*>/g, "").slice(0, 500)
    : null;

  for (const key of CONSENT_KEYS) {
    const granted = input.consent[key];
    const prior = await latestLog(tx, input.subjectType, input.subjectId, key);

    if (prior && prior.granted === granted) continue;

    await tx.consentLog.create({
      data: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        consentKey: key,
        granted,
        grantedBy: input.grantedBy ?? null,
        grantedAt: now,
        ipMask: input.ipMask ?? null,
        userAgent: truncUa,
        source: input.source,
        reason: sanitizedReason,
      },
    });

    await subjectDelegate(tx, input.subjectType).update({
      where: { id: input.subjectId },
      data: denormalizedUpdate(key, granted, input.ipMask, now),
    });

    changes.push(key);
  }

  return { changes };
}

export async function getActiveConsent(
  db: Db,
  subjectType: SubjectType,
  subjectId: string,
): Promise<ActiveConsent> {
  const empty = (): ActiveConsentEntry => ({
    granted: false,
    at: null,
    source: null,
  });

  const result: ActiveConsent = {
    marketing: empty(),
    tracking: empty(),
  };

  for (const key of CONSENT_KEYS) {
    const log = await latestLog(db, subjectType, subjectId, key);
    if (log) {
      result[key] = {
        granted: log.granted,
        at: log.grantedAt,
        source: log.source as ConsentSource,
      };
    }
  }

  return result;
}

async function canDo(
  db: Db,
  subjectType: SubjectType,
  subjectId: string,
  key: ConsentKey,
): Promise<boolean> {
  const subject = await readDelegate(db, subjectType).findUnique({
    where: { id: subjectId },
    select:
      key === "marketing"
        ? { consentMarketing: true }
        : { consentTracking: true },
  });
  if (!subject) return false;
  return key === "marketing"
    ? Boolean((subject as { consentMarketing: boolean }).consentMarketing)
    : Boolean((subject as { consentTracking: boolean }).consentTracking);
}

export async function canSendMarketing(
  db: Db,
  subjectId: string,
  subjectType: SubjectType = "contact",
): Promise<boolean> {
  return canDo(db, subjectType, subjectId, "marketing");
}

export async function canTrackOpen(
  db: Db,
  subjectId: string,
  subjectType: SubjectType = "contact",
): Promise<boolean> {
  return canDo(db, subjectType, subjectId, "tracking");
}
