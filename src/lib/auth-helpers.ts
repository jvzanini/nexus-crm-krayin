import { validatePassword } from "@nexusai360/core";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  platformRole: string;
  avatarUrl: string | null;
  theme: string;
}

export async function authorizeCredentials(
  credentials: { email: string; password: string },
  ipAddress: string
): Promise<AuthUser | null> {
  const { email, password } = credentials;

  // Verificar rate limit
  const rateLimit = await checkLoginRateLimit(email, ipAddress).catch(() => ({
    allowed: true,
    remaining: 5,
  }));

  if (!rateLimit.allowed) {
    return null;
  }

  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      isActive: true,
      isSuperAdmin: true,
      platformRole: true,
      avatarUrl: true,
      theme: true,
    },
  });

  if (!user) return null;

  // Verificar senha
  const validPassword = await validatePassword(password, user.password);
  if (!validPassword) return null;

  // Verificar usuário ativo
  if (!user.isActive) return null;

  // Login bem-sucedido — limpar rate limit
  await clearLoginRateLimit(email, ipAddress).catch(() => {});

  // Registrar audit log (fire-and-forget)
  prisma.auditLog
    .create({
      data: {
        actorType: "user",
        actorId: user.id,
        actorLabel: user.email,
        action: "auth.login",
        resourceType: "User",
        resourceId: user.id,
        details: { ip: ipAddress },
      },
    })
    .catch(() => {});

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    platformRole: user.platformRole,
    avatarUrl: user.avatarUrl,
    theme: user.theme,
  };
}
