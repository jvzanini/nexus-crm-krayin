import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveOAuthState } from "@/lib/email/oauth-state";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const clientId = process.env.MS_OAUTH_CLIENT_ID;
  const redirectUri = process.env.MS_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "OAUTH_NOT_CONFIGURED",
        message:
          "Defina MS_OAUTH_CLIENT_ID e MS_OAUTH_REDIRECT_URI no ambiente para habilitar a conexão com o Outlook.",
      },
      { status: 503 },
    );
  }

  const state = await saveOAuthState(user.id);
  const scope = ["offline_access", "Mail.Send", "Mail.Read"].join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
    response_mode: "query",
  });

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  logger.info({ userId: user.id }, "oauth.outlook.authorize.redirect");
  return NextResponse.redirect(authUrl);
}
