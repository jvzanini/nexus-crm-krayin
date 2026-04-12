import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { authorizeCredentials } from "@/lib/auth-helpers";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request?.headers?.get("x-real-ip") ||
          "unknown";

        return authorizeCredentials(parsed.data, ip);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Se tem novo login, pegar dados do user
      if (user) {
        token.id = user.id;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.platformRole = (user as any).platformRole;
        token.avatarUrl = (user as any).avatarUrl;
        token.theme = (user as any).theme;
        return token;
      }

      // Refresh em cada requisição — buscar dados atuais do banco
      if (token.id) {
        try {
          const { prisma } = await import("@/lib/prisma");
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              name: true,
              email: true,
              isSuperAdmin: true,
              platformRole: true,
              avatarUrl: true,
              theme: true,
              isActive: true,
            },
          });

          if (!dbUser || !dbUser.isActive) {
            // Usuário inativo — invalidar sessão
            return null as any;
          }

          token.name = dbUser.name;
          token.email = dbUser.email;
          token.isSuperAdmin = dbUser.isSuperAdmin;
          token.platformRole = dbUser.platformRole;
          token.avatarUrl = dbUser.avatarUrl;
          token.theme = dbUser.theme;
        } catch {
          // Em caso de erro, manter token existente
        }
      }

      return token;
    },
  },
});
