# Frente 14b — CRM adopt @nexusai360/settings-ui

**Status:** v3 APPROVED (Review 2 sem issues)
**Data:** 2026-04-14
**Autor:** implementer autônomo (sessão Claude)
**Herda de:** Frentes 8 (core), 9 (multi-tenant), 10 (audit-log), 11 (api-keys) — já MERGED em `main`.

## 1. Contexto e objetivo

A Frente 14a publicou `@nexusai360/settings-ui@0.2.0` (tag `v0.3.0-ui-packages`) no GitHub Packages. O pacote encapsula:

- Client components `SettingsContent` e `FlagsContent`.
- Server helpers: schemas Zod (`setSettingSchema`, `setFlagSchema`, `overrideFlagSchema`), DTO (`toSettingsDTO`), permissões (`canEditSettings`, `canManageFlags`, `setPermissionResolver`), `SettingsAdapter` / `FlagsAdapter` interfaces, error types.
- Mapeamento `snake_case → camelCase` quebrado: o pacote usa `platformName`, `supportEmail`, `notificationsEnabled`, `maintenanceMode`; o CRM hoje grava `platform_name`, `support_email`, `notifications_email`, `notifications_platform`, `maintenance_mode`.

O objetivo da Frente 14b é **substituir a implementação ad hoc** de `/settings` e `/settings/flags` pelo pacote versionado, mantendo paridade funcional (exceto pela consolidação de `notifications_email` + `notifications_platform` num único `notificationsEnabled`).

## 2. Escopo

### In scope
1. Vendor tarball do pacote para `vendor-packages/` + checksum SHA256.
2. Dependência em `package.json` (`file:./vendor-packages/…`).
3. Adapters Prisma:
   - `src/lib/adapters/settings/prisma-settings-adapter.ts` → `SettingsAdapter` sobre model `GlobalSettings`.
   - `src/lib/adapters/settings/prisma-flags-adapter.ts` → `FlagsAdapter` sobre `FeatureFlag` + `FeatureFlagOverride` (reaproveitando `setFlag`, `overrideFlag`, `clearOverride`, `listFlags` existentes em `src/lib/flags/index.ts` para preservar cache Redis).
4. Refactor server actions:
   - `src/lib/actions/settings.ts`: `saveSettingAction(input)` usando `setSettingSchema`, delegando ao adapter, chamando `revalidatePath("/settings")`.
   - `src/lib/actions/feature-flags.ts`: `setFlagAction`, `overrideFlagAction`, `clearOverrideAction` migrados para delegar ao adapter e usar schemas do pacote.
5. Refactor pages:
   - `src/app/(protected)/settings/page.tsx`: render `<SettingsContent initialSettings onSave canEdit />`.
   - `src/app/(protected)/settings/flags/page.tsx`: render `<FlagsContent initialFlags onSetFlag onSetOverride onClearOverride canManage />`.
6. Boot: **se** o CRM usar role names diferentes do mapa default do pacote, chamar `setPermissionResolver` em `instrumentation.ts#register()`. O CRM já usa `super_admin | admin | manager | viewer` — bate 1:1 com o mapa default; decisão: **não criar** `instrumentation.ts` nem chamar resolver custom.
7. Deletar:
   - `src/app/(protected)/settings/_components/settings-content.tsx`
   - `src/app/(protected)/settings/flags/_components/flags-content.tsx`
8. Testes:
   - Vitest unit para cada adapter (2-4 cases) com Prisma mockado (vi.mock).
   - Playwright specs em `tests/e2e/golden-paths/settings.spec.ts` (admin project já existe) smoke de render + interação básica.
9. CI local: `npm install && npx tsc --noEmit && npx vitest run && npm run build` verdes (repo usa `npm` — tem `package-lock.json` e `test:e2e:ci` chama `npm run`).
10. PR → squash merge `--admin` → atualizar MEMORY.

### Out of scope
- Migração de dados históricos em `global_settings` (chaves `snake_case` antigas ficarão órfãs; documentar como concern — ver §7).
- Branding custom do `SettingsContent`/`FlagsContent` (pacote já tem visual do DS).
- Alterações em `src/lib/flags/resolve.ts` ou no cache Redis.
- Mudança no RBAC check existente.

## 3. Arquitetura

```
  Page (server)                    Server Action                    Adapter                   Prisma
  ────────────                     ─────────────                     ───────                   ──────
  settings/page.tsx  ── calls ──▶  saveSettingAction(input)
       │                            │   parse with setSettingSchema
       │                            │   auth() → userId                                        
       │                            │   adapter.setSetting(k,v,userId) ──────▶  upsert(key,value,updatedBy)
       │                            │   revalidatePath("/settings")
       │                            ◀── ActionResult
       │   initialSettings = toSettingsDTO(adapter.getAllSettings())
       ▼
  <SettingsContent initialSettings onSave={saveSettingAction} canEdit={canEditSettings(role)} />

  flags/page.tsx    ── analogous flow via FlagsAdapter → reusa src/lib/flags/index.ts funções (cache-aware)
```

**Chave do design:** o `PrismaFlagsAdapter` delega aos helpers já existentes em `src/lib/flags/index.ts` para preservar invalidação Redis. O `PrismaSettingsAdapter` vai direto ao `prisma.globalSettings`.

## 4. Interfaces

### PrismaSettingsAdapter

```ts
import type { SettingsAdapter } from "@nexusai360/settings-ui/server-helpers";

export class PrismaSettingsAdapter implements SettingsAdapter {
  async getAllSettings(): Promise<Record<string, unknown>> {
    const rows = await prisma.globalSettings.findMany();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
  async getSetting(key: string): Promise<unknown | null> {
    const row = await prisma.globalSettings.findUnique({ where: { key } });
    return row?.value ?? null;
  }
  async setSetting(key: string, value: unknown, updatedBy: string): Promise<void> {
    await prisma.globalSettings.upsert({
      where: { key },
      update: { value: value as Prisma.JsonValue, updatedBy },
      create: { key, value: value as Prisma.JsonValue, updatedBy },
    });
  }
}
```

### PrismaFlagsAdapter

```ts
import type { FlagsAdapter, Flag, SetFlagInput, SetOverrideInput }
  from "@nexusai360/settings-ui/server-helpers";
import { listFlags, setFlag, overrideFlag, clearOverride }
  from "@/lib/flags";

export class PrismaFlagsAdapter implements FlagsAdapter {
  async list(): Promise<Flag[]> {
    const rows = await listFlags();
    return rows.map(r => ({
      key: r.key,
      description: r.description,
      enabled: r.enabled,
      rolloutPct: r.rolloutPct,
      updatedAt: r.updatedAt,
      overrides: r.overrides.map(o => ({
        scope: o.scope as "company" | "user",
        scopeId: o.scopeId,
        enabled: o.enabled,
      })),
    }));
  }
  async set(input: SetFlagInput, updatedBy: string): Promise<void> {
    const { key, ...patch } = input;
    await setFlag(key, patch, { userId: updatedBy });
  }
  async setOverride(input: SetOverrideInput): Promise<void> {
    await overrideFlag(input.key, input.scope, input.scopeId, input.enabled);
  }
  async clearOverride(key: string, scope: "company" | "user", scopeId: string): Promise<void> {
    await clearOverride(key, scope, scopeId);
  }
}
```

Singletons exportados: `settingsAdapter`, `flagsAdapter`.

### Server actions (nova forma)

```ts
// src/lib/actions/settings.ts
"use server";
export async function saveSettingAction(input: SetSettingInput): Promise<ActionResult> {
  const parsed = setSettingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "unauthenticated" };
  if (!canEditSettings(user.platformRole as PlatformRole))
    return { success: false, error: "forbidden" };
  await settingsAdapter.setSetting(parsed.data.key, parsed.data.value, user.id);
  revalidatePath("/settings");
  return { success: true };
}
```

Analogous para `setFlagAction`, `overrideFlagAction`, `clearOverrideAction`.

### Pages

```tsx
// settings/page.tsx
import { SettingsContent } from "@nexusai360/settings-ui";
import { toSettingsDTO, canEditSettings, canViewSettings } from "@nexusai360/settings-ui/server-helpers";
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewSettings(user.platformRole as PlatformRole)) redirect("/dashboard");
  const raw = await settingsAdapter.getAllSettings();
  return (
    <SettingsContent
      initialSettings={toSettingsDTO(raw)}
      onSave={saveSettingAction}
      canEdit={canEditSettings(user.platformRole as PlatformRole)}
    />
  );
}
```

## 5. Testes

### Vitest unit (novos arquivos)
- `src/lib/adapters/settings/prisma-settings-adapter.test.ts`
  1. `getAllSettings` retorna Record a partir de rows.
  2. `setSetting` chama `upsert` com updatedBy.
  3. `getSetting` retorna null quando ausente.
- `src/lib/adapters/settings/prisma-flags-adapter.test.ts`
  1. `list` mapeia overrides.
  2. `set` chama `setFlag` helper com patch.
  3. `setOverride` delega.
  4. `clearOverride` delega.

Prisma e helpers `src/lib/flags` mockados via `vi.mock`.

### Playwright smoke
- `tests/e2e/golden-paths/settings.spec.ts` (admin project):
  1. `/settings` carrega, título "Configurações" visível.
  2. `/settings/flags` carrega, botão "Nova flag" visível.
  3. Sem `test.skip`: segue o pattern do repo (global-setup faz login real; não há guard de env).

## 6. Entregáveis (artefatos)
- `docs/superpowers/specs/2026-04-14-crm-adopt-settings-ui.md` (este arquivo, v3 APPROVED)
- `docs/superpowers/plans/2026-04-14-crm-adopt-settings-ui.md` (v3 APPROVED)
- `vendor-packages/nexusai360-settings-ui-0.2.0.tgz` + checksum.
- `src/lib/adapters/settings/{prisma-settings-adapter,prisma-flags-adapter,index}.ts` (+ `.test.ts`).
- Server actions refatoradas.
- Pages refatoradas.
- Components antigos deletados.
- Spec Playwright nova.
- PR squash-merged.

## 7. Concerns e decisões autônomas

1. **Chaves snake_case órfãs:** o CRM atual grava `platform_name`, `support_email`, `notifications_email`, `notifications_platform`, `maintenance_mode`. O pacote espera `platformName`, `supportEmail`, `notificationsEnabled`, `maintenanceMode`. **Decisão:** escrever migração SQL leve idempotente via Prisma raw numa rota `scripts/migrate-settings-keys.ts` e **NÃO** executar automaticamente (fora do escopo de código da Frente 14b) — documentar no CHANGELOG/PR. Em dev/prod, chaves novas começam vazias; o `toSettingsDTO` retorna `undefined` para ausentes e o `SettingsContent` trata. Perda funcional: `notifications_email` e `notifications_platform` colapsam em `notificationsEnabled` — aceitável pois é recurso interno.
2. **Gerenciador de pacotes:** o CRM tem `package-lock.json` e scripts em `npm run …`, mas o prompt-pai fala em `pnpm`. **Decisão:** usar `npm` (o canônico do repo, conforme `scripts.test:e2e:ci`).
3. **Action result i18n:** erros hoje em português ("Não autorizado"). O pacote retorna chaves inglês (`unauthenticated`, `forbidden`). **Decisão:** padronizar em inglês nas actions novas (alinhar com padrão do pacote e Frentes prévias — core/multi-tenant).
4. **Feature flag dialog "Nova flag":** pacote expõe `onSetFlag` para criar; não há endpoint separado. Aceitável.
5. **Skip Playwright sem POSTGRES_URL:** os specs existentes NÃO usam esse guard — eles dependem de `global-setup.ts` que faz login real. **Decisão:** seguir pattern do repo e NÃO adicionar `test.skip`. Se CI precisar, adiciona depois.

## 8. Critérios de aceitação

- [ ] `pnpm install` (=`npm install`) sem erros; vendor verify passa.
- [ ] `npm run build` (Next) verde.
- [ ] `npx vitest run` — suíte inteira verde, novos testes dos adapters passam.
- [ ] `/settings` renderiza via componente do pacote; toggle persiste.
- [ ] `/settings/flags` renderiza via componente do pacote; toggle + criar flag persistem.
- [ ] PR abre, squash-merge via `--admin` (Lei YOLO) limpa.
- [ ] MEMORY atualizado.
