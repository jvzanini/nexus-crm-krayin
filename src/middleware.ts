import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default async function middleware(req: NextRequest) {
  // Gate da rota /__ds-preview: retorna 404 quando DS_PREVIEW não está ligado
  if (req.nextUrl.pathname.startsWith("/__ds-preview")) {
    if (process.env.DS_PREVIEW !== "true") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // Delega para o middleware de auth nas demais rotas
  return (auth as unknown as (req: NextRequest) => Promise<NextResponse>)(req);
}

export const config = {
  matcher: [
    "/__ds-preview/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
