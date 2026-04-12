import { auth } from "@/auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  platformRole: string;
  avatarUrl: string | null;
  theme: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as any;
  return {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    isSuperAdmin: user.isSuperAdmin ?? false,
    platformRole: user.platformRole ?? "viewer",
    avatarUrl: user.avatarUrl ?? null,
    theme: user.theme ?? "dark",
  };
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
  return user;
}
