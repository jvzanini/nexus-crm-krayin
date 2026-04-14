// src/app/api/v1/subjects/[type]/[id]/consent/revoke/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { recordConsent } from "@/lib/consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: z.string().max(500).optional() });
const ALLOWED = new Set(["lead", "contact"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "INVALID_SUBJECT_TYPE" }, { status: 400 });
  }

  try {
    const user = await requirePermission("dsar:execute");

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "INVALID_BODY" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await recordConsent(tx, {
        subjectType: type as "lead" | "contact",
        subjectId: id,
        consent: { marketing: false, tracking: false },
        source: "dsar",
        grantedBy: user.id,
        reason: parsed.data.reason ?? null,
      });
    });

    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      action: "subject.consent_revoked",
      resourceType: type,
      resourceId: id,
      details: { reason: parsed.data.reason ?? null },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    logger.error({ err, type, id }, "dsar.revoke.failed");
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
