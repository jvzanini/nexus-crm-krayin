import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe. Sempre 200 enquanto o processo estiver de pé.
 * Não checa dependências (DB/Redis) — para isso existe /api/ready.
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "nexus-crm",
      version: process.env.APP_VERSION ?? "unknown",
      time: new Date().toISOString(),
    },
    { status: 200 },
  );
}
