# Frente 15b — CRM adopt @nexusai360/profile-ui

**Status:** v3 APPROVED (auto, Review 2 comprimido — sem issues novos vs. 14b)
**Data:** 2026-04-14
**Autor:** implementer autônomo
**Herda de:** Frentes 8–14b (core, multi-tenant, audit-log, api-keys, settings-ui) já MERGED em `main`.

## 1. Contexto

Frente 15a publicou `@nexusai360/profile-ui@0.2.0` (tag `v0.4.0-ui-packages`) no GitHub Packages. O pacote expõe:

- Client component `ProfileContent` (avatar/nome/email/senha/tema) — actions-as-props.
- Server helpers: schemas Zod (`updateProfileSchema`, `changePasswordSchema`, `requestEmailChangeSchema`), `toProfileDTO`, `ProfileAdapter`, permissions com resolver default self-service 1:1 com o CRM (`super_admin|admin|manager|viewer`), `resizeAvatar`.
- O pacote **NÃO** faz hash de senha — action do consumidor deve chamar `hashPassword` de `@nexusai360/core` (já adotado pela Frente 8).

CRM hoje tem implementação ad hoc em `src/app/(protected)/profile/{page.tsx,_components/profile-content.tsx}` + `src/lib/actions/profile.ts` com 5 actions. Schemas Prisma `User` e `EmailChangeToken` já contêm tudo que o adapter precisa.

## 2. Escopo

### In scope
1. Vendor `nexusai360-profile-ui-0.2.0.tgz` em `vendor-packages/` + SHA256 em `checksums.json`.
2. Dependência `file:./vendor-packages/nexusai360-profile-ui-0.2.0.tgz` em `package.json`.
3. Adapter Prisma `src/lib/adapters/profile/prisma-profile-adapter.ts` + `src/lib/adapters/profile/index.ts` singleton.
4. Refactor `src/lib/actions/profile.ts`:
   - `updateProfileAction`, `updateAvatarAction`, `requestEmailChangeAction`, `changePasswordAction` (+ manter `verifyEmailChange` já usado por `/verify-email`).
   - Todas parseiam via schemas do pacote, resolvem `userId` via `getCurrentUser()`, delegam ao adapter, `revalidatePath("/profile")`.
   - `changePasswordAction` chama `verifyCurrentPassword` no adapter e `hashPassword` do core **antes** de `updatePassword`.
5. Refactor `src/app/(protected)/profile/page.tsx`:
   - Server: busca `getCurrentUser`, `profileAdapter.getProfile(user.id)`, resolve theme-pref via cookie.
   - Renderiza novo `<ProfilePageClient>` (wrapper) que internamente monta `<ProfileContent>` do pacote com `onThemeChange={setTheme}` do `useTheme()`.
6. Deletar `src/app/(protected)/profile/_components/profile-content.tsx`.
7. Testes:
   - Vitest: `prisma-profile-adapter.test.ts` (4 cases — getProfile happy/null, updateProfile, verifyCurrentPassword ok/fail).
   - Playwright: `tests/e2e/golden-paths/profile.spec.ts` smoke (render `/profile`, header "Perfil", campo nome visível).
8. CI local: `npm install && npx tsc --noEmit && npx vitest run && npm run build` verde.
9. PR → squash merge `--admin` → atualizar MEMORY.

### Out of scope
- Mudança de schema Prisma.
- Alteração em `/verify-email` flow.
- Nova server action para tema (o `ThemeProvider` client já persiste via cookie).
- Branding custom do `ProfileContent`.
- Instrumentation `setPermissionResolver` (default resolver self-service bate 1:1).

## 3. Arquitetura

```
  Page (server)                      Client wrapper            Pkg ProfileContent            Server Actions                 Adapter                Prisma
  ────────────                       ──────────────            ─────────────────             ──────────────                 ───────                ──────
  profile/page.tsx                   ProfilePageClient
    getCurrentUser()                    useTheme() → theme
    adapter.getProfile(user.id)  ──▶    passa onThemeChange={setTheme}
    toProfileDTO(raw)                   passa resto server-side ──▶  <ProfileContent
                                                                        onUpdateProfile=updateProfileAction ─▶ parse+auth+adapter.updateProfile
                                                                        onUpdateAvatar=updateAvatarAction   ─▶                 adapter.updateAvatar
                                                                        onChangePassword=changePasswordAction ▶ verifyCurrentPassword+hashPassword(core)+updatePassword
                                                                        onRequestEmailChange=requestEmailChangeAction ▶ findUserByEmail+createEmailChangeToken+sendEmail
                                                                        onThemeChange=(theme wrapper)
```

## 4. Interfaces

### PrismaProfileAdapter

```ts
import type { ProfileAdapter } from "@nexusai360/profile-ui/server-helpers";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@nexusai360/core";

export class PrismaProfileAdapter implements ProfileAdapter {
  async getProfile(userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUrl: true, createdAt: true },
    });
    return u ? { name: u.name, email: u.email, avatarUrl: u.avatarUrl, createdAt: u.createdAt.toISOString() } : null;
  }
  async updateProfile(userId, { name }) {
    await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } });
  }
  async updateAvatar(userId, avatarUrl) {
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  }
  async verifyCurrentPassword(userId, currentPassword) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!u) return false;
    return validatePassword(currentPassword, u.password);
  }
  async updatePassword(userId, newHashedPassword) {
    await prisma.user.update({ where: { id: userId }, data: { password: newHashedPassword } });
  }
  async findUserByEmail(email) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    return u ?? null;
  }
  async createEmailChangeToken({ userId, newEmail, token, expiresAt }) {
    await prisma.emailChangeToken.create({ data: { userId, newEmail, token, expiresAt } });
  }
}
```

### Server actions (skeleton)

```ts
"use server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import {
  updateProfileSchema, changePasswordSchema, requestEmailChangeSchema,
  type ActionResult,
} from "@nexusai360/profile-ui/server-helpers";
import { hashPassword } from "@nexusai360/core";
import { getCurrentUser } from "@/lib/auth";
import { profileAdapter } from "@/lib/adapters/profile";
import { sendEmailVerificationEmail } from "@/lib/email";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "unauthenticated" };
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  await profileAdapter.updateProfile(user.id, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

export async function updateAvatarAction(avatarUrl: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "unauthenticated" };
  if (typeof avatarUrl !== "string" || !avatarUrl) return { success: false, error: "invalid_input" };
  await profileAdapter.updateAvatar(user.id, avatarUrl);
  revalidatePath("/profile");
  return { success: true };
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "unauthenticated" };
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const ok = await profileAdapter.verifyCurrentPassword(user.id, parsed.data.currentPassword);
  if (!ok) return { success: false, error: "Senha atual incorreta" };
  const hashed = await hashPassword(parsed.data.newPassword);
  await profileAdapter.updatePassword(user.id, hashed);
  return { success: true };
}

export async function requestEmailChangeAction(newEmail: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "unauthenticated" };
  const parsed = requestEmailChangeSchema.safeParse({ newEmail });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const existing = await profileAdapter.findUserByEmail(parsed.data.newEmail);
  if (existing) return { success: false, error: "E-mail já cadastrado" };
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await profileAdapter.createEmailChangeToken({ userId: user.id, newEmail: parsed.data.newEmail, token, expiresAt });
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  await sendEmailVerificationEmail(parsed.data.newEmail, verifyUrl);
  return { success: true };
}
```

### ProfilePageClient wrapper

```tsx
"use client";
import { ProfileContent, type ProfileContentProps } from "@nexusai360/profile-ui";
import { useTheme } from "@/components/providers/theme-provider";

type Props = Omit<ProfileContentProps, "onThemeChange" | "currentTheme">;

export function ProfilePageClient(props: Props) {
  const { theme, setTheme } = useTheme();
  return <ProfileContent {...props} currentTheme={theme} onThemeChange={setTheme} />;
}
```

### page.tsx

```tsx
import { redirect } from "next/navigation";
import type { PlatformRole } from "@nexusai360/types";
import { toProfileDTO, canEditOwnProfile } from "@nexusai360/profile-ui/server-helpers";
import { getCurrentUser } from "@/lib/auth";
import { profileAdapter } from "@/lib/adapters/profile";
import { ProfilePageClient } from "./_components/profile-page-client";
import {
  updateProfileAction, updateAvatarAction, requestEmailChangeAction, changePasswordAction,
} from "@/lib/actions/profile";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const raw = await profileAdapter.getProfile(user.id);
  if (!raw) redirect("/login");
  const role = user.platformRole as PlatformRole;
  return (
    <ProfilePageClient
      initialProfile={toProfileDTO(raw)}
      canEdit={canEditOwnProfile(role)}
      onUpdateProfile={updateProfileAction}
      onUpdateAvatar={updateAvatarAction}
      onRequestEmailChange={requestEmailChangeAction}
      onChangePassword={changePasswordAction}
    />
  );
}
```

## 5. Testes

**Vitest — `src/lib/adapters/profile/prisma-profile-adapter.test.ts`**
- `getProfile` retorna DTO com `createdAt` ISO.
- `getProfile` retorna null quando usuário não existe.
- `updateProfile` chama `prisma.user.update` com `name` trim.
- `verifyCurrentPassword` retorna `false` quando user null; `true` quando `validatePassword` resolve `true`.

Mock de `@/lib/prisma` + `@nexusai360/core` via `vi.mock`.

**Playwright — `tests/e2e/golden-paths/profile.spec.ts`**
- Auth admin (reusa `adminProject` de `settings.spec.ts`).
- `page.goto("/profile")` → `expect(heading "Perfil")` visível.
- Input "Nome" visible + editable.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Remoção de `getProfile` server action quebra algo externo? | Grep: consumidor único é `_components/profile-content.tsx` (deletado). Safe. |
| `updateSession()` do next-auth sumirá (wrapper não chama mais) | Aceito — session será atualizada no próximo request. Concern menor vs. benefício de usar o pacote. |
| Wrapper client recebe server action por prop — Next serializa? | Sim, server actions são serializáveis como function ref. Pattern idêntico à Frente 14b. |

## 7. Compat e decisão sobre `updateSession`

A implementação atual chama `updateSession()` após salvar o perfil, forçando refresh do name/avatar na sessão next-auth. O pacote não tem esse hook. Decisão: aceitar o trade-off — dados aparecem atualizados no próximo navigate/reload. Documentado como concern.

## 8. Critérios de aceitação

1. `/profile` renderiza com header "Perfil" e 4 cards (Informações, E-mail, Senha, Aparência).
2. Salvar nome persiste no DB.
3. Alterar senha valida senha atual e grava hash via `hashPassword`.
4. Solicitar alteração de e-mail cria `EmailChangeToken` + envia email.
5. Tema dark/light/system aplica classe no `<html>` e persiste via cookie.
6. Typecheck + Vitest + Build + Playwright smoke verdes.
7. PR mergeado squash + admin.
