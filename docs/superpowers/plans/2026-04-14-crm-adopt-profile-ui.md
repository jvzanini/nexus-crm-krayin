# CRM adopt @nexusai360/profile-ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a página `/profile` do CRM pelo pacote versionado `@nexusai360/profile-ui@0.2.0`.

**Architecture:** Adapter Prisma sobre `User` + `EmailChangeToken`; server actions parseiam via schemas do pacote e delegam ao adapter; `hashPassword` vem de `@nexusai360/core`; page server-side monta props e um thin client wrapper injeta `onThemeChange` via `useTheme()`.

**Tech Stack:** Next 16, React 19, Prisma 7, npm, Vitest, Playwright, `@nexusai360/profile-ui`, `@nexusai360/core`, `@nexusai360/types`.

---

### Task 1: Vendor tarball + checksum

**Files:**
- Create: `vendor-packages/nexusai360-profile-ui-0.2.0.tgz`
- Modify: `vendor-packages/checksums.json`

- [ ] **Step 1:** Gerar tarball do pacote publicado.

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint" && \
pnpm --filter @nexusai360/profile-ui pack --pack-destination /tmp/
```

Esperado: `/tmp/nexusai360-profile-ui-0.2.0.tgz` criado.

- [ ] **Step 2:** Copiar para `vendor-packages/` do CRM.

```bash
cp /tmp/nexusai360-profile-ui-0.2.0.tgz \
   "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin/vendor-packages/"
```

- [ ] **Step 3:** Calcular SHA256.

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && \
shasum -a 256 vendor-packages/nexusai360-profile-ui-0.2.0.tgz
```

- [ ] **Step 4:** Adicionar entrada em `vendor-packages/checksums.json` no mesmo formato das demais (chave = nome do arquivo, valor = hash).

- [ ] **Step 5:** Rodar `node scripts/verify-vendor.mjs` e ver "OK".

- [ ] **Step 6:** Commit.

```bash
git add vendor-packages/nexusai360-profile-ui-0.2.0.tgz vendor-packages/checksums.json
git commit -m "chore(deps): vendor @nexusai360/profile-ui@0.2.0 tarball"
```

---

### Task 2: package.json + npm install

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1:** Adicionar em `dependencies` (manter ordem alfabética entre pacotes `@nexusai360`):

```json
"@nexusai360/profile-ui": "file:./vendor-packages/nexusai360-profile-ui-0.2.0.tgz",
```

- [ ] **Step 2:** `npm install`.

Esperado: sem erros; lockfile atualizado; sem warnings de peer `@nexusai360/types`/`@nexusai360/design-system` (já presentes).

- [ ] **Step 3:** Commit.

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @nexusai360/profile-ui@0.2.0"
```

---

### Task 3: PrismaProfileAdapter + testes Vitest

**Files:**
- Create: `src/lib/adapters/profile/prisma-profile-adapter.ts`
- Create: `src/lib/adapters/profile/index.ts`
- Create: `src/lib/adapters/profile/prisma-profile-adapter.test.ts`

- [ ] **Step 1: Escrever test primeiro.** Arquivo `src/lib/adapters/profile/prisma-profile-adapter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    emailChangeToken: { create: vi.fn() },
  },
}));
vi.mock("@nexusai360/core", () => ({
  validatePassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { validatePassword } from "@nexusai360/core";
import { PrismaProfileAdapter } from "./prisma-profile-adapter";

describe("PrismaProfileAdapter", () => {
  const adapter = new PrismaProfileAdapter();
  beforeEach(() => vi.clearAllMocks());

  it("getProfile retorna DTO com createdAt ISO", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    (prisma.user.findUnique as any).mockResolvedValue({
      name: "Jo", email: "j@x.io", avatarUrl: null, createdAt,
    });
    const dto = await adapter.getProfile("u1");
    expect(dto).toEqual({
      name: "Jo", email: "j@x.io", avatarUrl: null, createdAt: createdAt.toISOString(),
    });
  });

  it("getProfile retorna null quando usuário não existe", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    expect(await adapter.getProfile("nope")).toBeNull();
  });

  it("updateProfile trimma name", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    await adapter.updateProfile("u1", { name: "  Maria  " });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" }, data: { name: "Maria" },
    });
  });

  it("verifyCurrentPassword false quando user não existe", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    expect(await adapter.verifyCurrentPassword("u1", "x")).toBe(false);
  });

  it("verifyCurrentPassword delega a validatePassword quando user existe", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: "hash" });
    (validatePassword as any).mockResolvedValue(true);
    expect(await adapter.verifyCurrentPassword("u1", "plain")).toBe(true);
    expect(validatePassword).toHaveBeenCalledWith("plain", "hash");
  });
});
```

- [ ] **Step 2: Rodar** `npx vitest run src/lib/adapters/profile` — FAIL (adapter não existe).

- [ ] **Step 3: Implementar adapter em** `src/lib/adapters/profile/prisma-profile-adapter.ts`:

```ts
import type { ProfileAdapter } from "@nexusai360/profile-ui/server-helpers";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@nexusai360/core";

export class PrismaProfileAdapter implements ProfileAdapter {
  async getProfile(userId: string) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUrl: true, createdAt: true },
    });
    if (!u) return null;
    return {
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, input: { name: string }): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { name: input.name.trim() },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  }

  async verifyCurrentPassword(userId: string, currentPassword: string): Promise<boolean> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!u) return false;
    return validatePassword(currentPassword, u.password);
  }

  async updatePassword(userId: string, newHashedPassword: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHashedPassword },
    });
  }

  async findUserByEmail(email: string) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return u ?? null;
  }

  async createEmailChangeToken(input: {
    userId: string;
    newEmail: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.emailChangeToken.create({
      data: {
        userId: input.userId,
        newEmail: input.newEmail,
        token: input.token,
        expiresAt: input.expiresAt,
      },
    });
  }
}
```

- [ ] **Step 4: Criar singleton** `src/lib/adapters/profile/index.ts`:

```ts
import { PrismaProfileAdapter } from "./prisma-profile-adapter";
export const profileAdapter = new PrismaProfileAdapter();
```

- [ ] **Step 5: Rodar** `npx vitest run src/lib/adapters/profile` — PASS (5 cases).

- [ ] **Step 6: Commit.**

```bash
git add src/lib/adapters/profile
git commit -m "feat(adapters): Prisma ProfileAdapter + tests"
```

---

### Task 4: Refactor server actions

**Files:**
- Modify: `src/lib/actions/profile.ts` (substituir conteúdo mantendo `verifyEmailChange`)

- [ ] **Step 1:** Reescrever `src/lib/actions/profile.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import {
  updateProfileSchema,
  changePasswordSchema,
  requestEmailChangeSchema,
  type ActionResult,
} from "@nexusai360/profile-ui/server-helpers";
import { hashPassword } from "@nexusai360/core";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { profileAdapter } from "@/lib/adapters/profile";
import { sendEmailVerificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
    }
    await profileAdapter.updateProfile(user.id, parsed.data);
    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.update.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function updateAvatarAction(avatarUrl: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    if (typeof avatarUrl !== "string" || !avatarUrl) {
      return { success: false, error: "invalid_input" };
    }
    await profileAdapter.updateAvatar(user.id, avatarUrl);
    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.avatar.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
    }
    const ok = await profileAdapter.verifyCurrentPassword(user.id, parsed.data.currentPassword);
    if (!ok) return { success: false, error: "Senha atual incorreta" };
    const hashed = await hashPassword(parsed.data.newPassword);
    await profileAdapter.updatePassword(user.id, hashed);
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.password.failed");
    return { success: false, error: "internal_error" };
  }
}

export async function requestEmailChangeAction(newEmail: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "unauthenticated" };
    const parsed = requestEmailChangeSchema.safeParse({ newEmail });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
    }
    const existing = await profileAdapter.findUserByEmail(parsed.data.newEmail);
    if (existing) return { success: false, error: "E-mail já cadastrado" };
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await profileAdapter.createEmailChangeToken({
      userId: user.id,
      newEmail: parsed.data.newEmail,
      token,
      expiresAt,
    });
    const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
    await sendEmailVerificationEmail(parsed.data.newEmail, verifyUrl);
    return { success: true };
  } catch (err) {
    logger.error({ err }, "profile.email.request.failed");
    return { success: false, error: "internal_error" };
  }
}

// Mantido intacto — usado pela rota /verify-email
export async function verifyEmailChange(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const tokenRecord = await prisma.emailChangeToken.findUnique({ where: { token } });
  if (!tokenRecord) return { success: false, error: "Token inválido" };
  if (tokenRecord.usedAt) return { success: false, error: "Token já utilizado" };
  if (tokenRecord.expiresAt < new Date()) return { success: false, error: "Token expirado" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { email: tokenRecord.newEmail },
    }),
    prisma.emailChangeToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → verde.

- [ ] **Step 3:** Commit.

```bash
git add src/lib/actions/profile.ts
git commit -m "refactor(actions): delegate profile actions to package adapter"
```

---

### Task 5: ProfilePageClient wrapper + page refactor

**Files:**
- Create: `src/app/(protected)/profile/_components/profile-page-client.tsx`
- Modify: `src/app/(protected)/profile/page.tsx`

- [ ] **Step 1:** Criar wrapper `src/app/(protected)/profile/_components/profile-page-client.tsx`:

```tsx
"use client";

import { ProfileContent, type ProfileContentProps } from "@nexusai360/profile-ui";
import { useTheme } from "@/components/providers/theme-provider";

type Props = Omit<ProfileContentProps, "onThemeChange" | "currentTheme">;

export function ProfilePageClient(props: Props) {
  const { theme, setTheme } = useTheme();
  return (
    <ProfileContent {...props} currentTheme={theme} onThemeChange={setTheme} />
  );
}
```

- [ ] **Step 2:** Substituir `src/app/(protected)/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { PlatformRole } from "@nexusai360/types";
import {
  toProfileDTO,
  canEditOwnProfile,
} from "@nexusai360/profile-ui/server-helpers";
import { getCurrentUser } from "@/lib/auth";
import { profileAdapter } from "@/lib/adapters/profile";
import { ProfilePageClient } from "./_components/profile-page-client";
import {
  updateProfileAction,
  updateAvatarAction,
  requestEmailChangeAction,
  changePasswordAction,
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

- [ ] **Step 3:** `npx tsc --noEmit` → verde.

- [ ] **Step 4:** Commit.

```bash
git add src/app/\(protected\)/profile/page.tsx src/app/\(protected\)/profile/_components/profile-page-client.tsx
git commit -m "refactor(pages): /profile renders @nexusai360/profile-ui"
```

---

### Task 6: Deletar componente local obsoleto

**Files:**
- Delete: `src/app/(protected)/profile/_components/profile-content.tsx`

- [ ] **Step 1:** Conferir que ninguém mais importa o componente local (o único consumidor era `page.tsx`):

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
```

Rodar a busca: `rg "_components/profile-content" src` — esperado: zero hits após Task 5.

- [ ] **Step 2:** Remover arquivo.

```bash
git rm "src/app/(protected)/profile/_components/profile-content.tsx"
```

- [ ] **Step 3:** `npx tsc --noEmit` → verde.

- [ ] **Step 4:** Commit.

```bash
git commit -m "chore: delete legacy profile-content component"
```

---

### Task 7: Playwright smoke

**Files:**
- Create: `tests/e2e/golden-paths/profile.spec.ts`

- [ ] **Step 1:** Criar `tests/e2e/golden-paths/profile.spec.ts` (espelhando pattern de `settings.spec.ts`):

```ts
import { test, expect } from "@playwright/test";

test.describe("Profile — golden path", () => {
  test("renderiza página e campos principais", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByText("E-mail atual")).toBeVisible();
    await expect(page.getByText("Alterar Senha")).toBeVisible();
    await expect(page.getByText("Aparência")).toBeVisible();
  });
});
```

- [ ] **Step 2:** Commit.

```bash
git add tests/e2e/golden-paths/profile.spec.ts
git commit -m "test(e2e): profile golden-path smoke"
```

---

### Task 8: CI local verde

- [ ] **Step 1:** `npx tsc --noEmit` → verde.
- [ ] **Step 2:** `npx vitest run` → verde (test count aumenta em 5).
- [ ] **Step 3:** `npm run build` → verde.
- [ ] **Step 4:** Se qualquer passo falhar, diagnosticar e corrigir na task correspondente antes de prosseguir.

---

### Task 9: PR + merge + MEMORY

- [ ] **Step 1:** Push branch.

```bash
git push -u origin feat/pkg-profile-ui
```

- [ ] **Step 2:** Abrir PR.

```bash
gh pr create --title "Frente 15b: CRM adopt @nexusai360/profile-ui" --body "$(cat <<'EOF'
## Summary
- Vendored @nexusai360/profile-ui@0.2.0 e ligado via file:.
- Novo PrismaProfileAdapter sobre User + EmailChangeToken.
- Server actions (updateProfile/updateAvatar/changePassword/requestEmailChange) reescritas com schemas do pacote + hashPassword de @nexusai360/core.
- /profile agora renderiza ProfileContent do pacote via thin client wrapper (ponte useTheme → onThemeChange).
- Componente local profile-content.tsx deletado.

## Test plan
- [ ] npx tsc --noEmit
- [ ] npx vitest run (adapter tests)
- [ ] npm run build
- [ ] Playwright smoke /profile

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3:** Merge squash admin.

```bash
gh pr merge --squash --admin --delete-branch
```

- [ ] **Step 4:** Atualizar MEMORY.

Editar `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-blueprint/memory/project_crm_phase_status.md` anexando linha: `Frente 15b COMPLETA — CRM consome @nexusai360/profile-ui@0.2.0 (PR #N merged)`.

---

## Self-Review

- Spec coverage: Tasks 1-9 cobrem §2 in-scope 1-9 do spec (vendor→deps→adapter→actions→page→delete→tests→CI→PR).
- Placeholders: nenhum; todo código completo.
- Type consistency: `ProfileAdapter`, `ProfileContentProps`, `ActionResult` consistentes; nomes de action com sufixo `Action` uniformes.
- Critério de aceitação 5 (tema) coberto por wrapper (Task 5) + ThemeProvider existente.
