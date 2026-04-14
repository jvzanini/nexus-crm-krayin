import type { PrismaClient } from "@/generated/prisma/client";

export type SubjectType = "lead" | "contact" | "opportunity";

const SUBJECT_TYPES: readonly SubjectType[] = ["lead", "contact", "opportunity"];

export class SubjectNotFoundError extends Error {
  constructor(public subjectType: SubjectType, public subjectId: string) {
    super(`SUBJECT_NOT_FOUND:${subjectType}:${subjectId}`);
    this.name = "SubjectNotFoundError";
  }
}

export class InvalidSubjectTypeError extends Error {
  constructor(provided: string) {
    super(`INVALID_SUBJECT_TYPE:${provided}`);
    this.name = "InvalidSubjectTypeError";
  }
}

export interface SubjectExportPayload {
  subjectType: SubjectType;
  subjectId: string;
  exportedAt: Date;
  subject: Record<string, unknown>;
  activities: unknown[];
  emails: unknown[];
  consentLogs: unknown[];
  auditLogs: unknown[];
}

function subjectDelegate(db: PrismaClient, t: SubjectType) {
  if (t === "lead") return db.lead;
  if (t === "contact") return db.contact;
  if (t === "opportunity") return db.opportunity;
  throw new InvalidSubjectTypeError(t);
}

export async function buildSubjectExport(
  db: PrismaClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<SubjectExportPayload> {
  if (!SUBJECT_TYPES.includes(subjectType)) throw new InvalidSubjectTypeError(subjectType);

  const delegate = subjectDelegate(db, subjectType);
  const subject = await (delegate as any).findUnique({ where: { id: subjectId } });
  if (!subject) throw new SubjectNotFoundError(subjectType, subjectId);

  const [activities, emails, consentLogs, auditLogs] = await Promise.all([
    db.activity.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: "desc" },
    }),
    db.emailMessage.findMany({
      where: { subjectType, subjectId } as any,
      orderBy: { sentAt: "desc" },
    }),
    db.consentLog.findMany({
      where: { subjectType, subjectId },
      orderBy: { grantedAt: "desc" },
    }),
    db.auditLog.findMany({
      where: { resourceType: subjectType, resourceId: subjectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    subjectType,
    subjectId,
    exportedAt: new Date(),
    subject,
    activities,
    emails,
    consentLogs,
    auditLogs,
  };
}
