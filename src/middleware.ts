import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

function ensureRequestId(req: NextRequest): string {
  const existing = req.headers.get("x-request-id");
  if (existing && existing.length > 0 && existing.length <= 128) return existing;
  // UUID v4 via crypto (disponível em edge)
  return (crypto as unknown as { randomUUID: () => string }).randomUUID();
}

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  return res;
}

export default async function middleware(req: NextRequest) {
  const requestId = ensureRequestId(req);

  // Gate da rota /__ds-preview: retorna 404 quando DS_PREVIEW não está ligado
  if (req.nextUrl.pathname.startsWith("/__ds-preview")) {
    if (process.env.DS_PREVIEW !== "true") {
      return withRequestId(new NextResponse(null, { status: 404 }), requestId);
    }
    return withRequestId(NextResponse.next(), requestId);
  }

  // Delega para o middleware de auth nas demais rotas
  const res = await (auth as unknown as (req: NextRequest) => Promise<NextResponse>)(req);
  return withRequestId(res, requestId);
}

export const config = {
  matcher: [
    "/__ds-preview/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
