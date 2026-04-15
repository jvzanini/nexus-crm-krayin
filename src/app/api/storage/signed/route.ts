import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "stream";
import { createStorage } from "@/lib/storage";
import { verifySignedUrlParams } from "@/lib/storage/sign";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentTypeFor(key: string): string {
  if (key.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (key.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/octet-stream";
}

/**
 * GET /api/storage/signed?key=<b64>&sig=<hex>&exp=<unix>
 *
 * Valida HMAC + expiração. Streama o arquivo do storage. Emite
 * audit `data_transfer.export.downloaded` com IP/UA do request.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyB64 = searchParams.get("key");
  const sig = searchParams.get("sig");
  const exp = searchParams.get("exp");
  if (!keyB64 || !sig || !exp) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }
  const result = verifySignedUrlParams({ key: keyB64, sig, exp });
  if (!result.valid || !result.key) {
    return NextResponse.json(
      { error: result.reason ?? "invalid" },
      { status: 403 },
    );
  }

  const storage = createStorage();
  let nodeStream: Readable;
  try {
    nodeStream = await storage.get(result.key);
  } catch (err) {
    logger.error({ err, key: result.key }, "storage.signed.get.failed");
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Auditoria best-effort — não bloqueia download.
  try {
    const user = await getCurrentUser().catch(() => null);
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename") ?? undefined;
    await auditLog({
      actorType: "user",
      actorId: user?.id ?? "",
      actorLabel: user?.email ?? "anonymous",
      action: "data_transfer.export.downloaded",
      resourceType: "data_transfer_job",
      details: {
        key: result.key,
        download,
        filename,
      },
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
  } catch (err) {
    logger.warn({ err }, "storage.signed.audit.failed");
  }

  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(result.key),
    "Cache-Control": "private, no-store",
  };
  const download = searchParams.get("download") === "1";
  const filename = searchParams.get("filename");
  if (download) {
    const fn = filename ?? result.key.split("/").pop() ?? "download";
    headers["Content-Disposition"] = `attachment; filename="${fn.replace(/"/g, "")}"`;
  }

  // Converte Node Readable → Web ReadableStream para Next Response.
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(webStream, { status: 200, headers });
}
