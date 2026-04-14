// src/app/api/v1/subjects/[type]/[id]/export/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import {
  buildSubjectExport,
  SubjectNotFoundError,
  InvalidSubjectTypeError,
  type SubjectType,
} from "@/lib/dsar/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  try {
    const user = await requirePermission("dsar:execute");

    const payload = await buildSubjectExport(prisma, type as SubjectType, id);

    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      action: "subject.exported",
      resourceType: type,
      resourceId: id,
      details: {
        counts: {
          activities: payload.activities.length,
          emails: payload.emails.length,
          consentLogs: payload.consentLogs.length,
          auditLogs: payload.auditLogs.length,
        },
      },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="subject-${id}-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof SubjectNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidSubjectTypeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error({ err, type, id }, "dsar.export.failed");
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
