import { NextResponse, type NextRequest } from "next/server";
import { consumeOAuthState } from "@/lib/email/oauth-state";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.json(
      { error: "OAUTH_PROVIDER_ERROR", detail: errorParam },
      { status: 400 },
    );
  }
  if (!state || !code) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const userId = await consumeOAuthState(state);
  if (!userId) {
    return NextResponse.json({ error: "INVALID_STATE" }, { status: 400 });
  }

  logger.warn({ userId }, "oauth.gmail.callback.not_implemented");
  return NextResponse.json(
    {
      error: "NOT_IMPLEMENTED",
      message:
        "Troca de authorization code será entregue em Fase 7b T4 (dependência: googleapis SDK + secret configurado).",
    },
    { status: 501 },
  );
}
