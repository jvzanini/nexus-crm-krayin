import type { NextAuthConfig } from "next-auth";

// auth.config.ts — Edge-safe (sem Prisma, bcrypt, ou imports Node.js pesados)
// Usado pelo middleware no Edge Runtime

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 dias
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Rotas públicas
      const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/verify-email"];
      const publicPrefixes = ["/api/auth/", "/api/health"];

      const isPublic =
        publicRoutes.some((r) => pathname === r || pathname.startsWith(r)) ||
        publicPrefixes.some((p) => pathname.startsWith(p));

      if (isPublic) return true;
      if (isLoggedIn) return true;

      return false;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.platformRole = (user as any).platformRole;
        token.avatarUrl = (user as any).avatarUrl;
        token.theme = (user as any).theme;
        token.locale = (user as any).locale;
        token.timezone = (user as any).timezone;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).isSuperAdmin = token.isSuperAdmin;
        (session.user as any).platformRole = token.platformRole;
        (session.user as any).avatarUrl = token.avatarUrl;
        (session.user as any).theme = token.theme;
        (session.user as any).locale = token.locale;
        (session.user as any).timezone = token.timezone;
      }
      return session;
    },
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig;
