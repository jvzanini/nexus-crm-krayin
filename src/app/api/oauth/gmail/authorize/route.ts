import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveOAuthState } from "@/lib/email/oauth-state";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "OAUTH_NOT_CONFIGURED",
        message:
          "Defina GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_REDIRECT_URI no ambiente para habilitar a conexão com o Gmail.",
      },
      { status: 503 },
    );
  }

  const state = await saveOAuthState(user.id);
  const scope = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "email",
  ].join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  logger.info({ userId: user.id }, "oauth.gmail.authorize.redirect");
  return NextResponse.redirect(authUrl);
}
