# Plan — Frente 14b: CRM adopt @nexusai360/settings-ui

**Status:** v3 APPROVED
**Spec:** `docs/superpowers/specs/2026-04-14-crm-adopt-settings-ui.md`
**Branch:** `feat/pkg-settings-ui`

## Tasks (granulares, 1 commit por task)

### T1 — Vendor tarball
- `cd nexus-blueprint/packages/settings-ui && npm pack --pack-destination=/tmp/`
- Copiar tgz para `nexus-crm-krayin/vendor-packages/`
- Atualizar `checksums.json` com SHA256 (`shasum -a 256 <tgz>`)
- Commit: `chore(deps): vendor @nexusai360/settings-ui@0.2.0 tarball`

### T2 — Dep + install
- Adicionar em `package.json` dependencies: `"@nexusai360/settings-ui": "file:./vendor-packages/nexusai360-settings-ui-0.2.0.tgz"`
- `npm install`
- Commit: `chore(deps): add @nexusai360/settings-ui@0.2.0`

### T3 — Adapters Prisma + testes
- Criar `src/lib/adapters/settings/prisma-settings-adapter.ts`
- Criar `src/lib/adapters/settings/prisma-flags-adapter.ts`
- Criar `src/lib/adapters/settings/index.ts` (barrel + singletons)
- Criar testes `.test.ts` para cada adapter (vi.mock `@/lib/prisma` e `@/lib/flags`)
- `npx vitest run src/lib/adapters/settings` — verde
- Commit: `feat(adapters): Prisma SettingsAdapter + FlagsAdapter`

### T4 — Refactor server actions
- Reescrever `src/lib/actions/settings.ts`: `saveSettingAction`, `getAllSettingsAction` (se necessário mas page usa adapter direto; manter apenas save)
- Reescrever `src/lib/actions/feature-flags.ts`: usar schemas do pacote, delegar ao `flagsAdapter`
- `npx tsc --noEmit` — verde
- Commit: `refactor(actions): delegate settings/flags to package adapters`

### T5 — Refactor pages
- `src/app/(protected)/settings/page.tsx` → render `<SettingsContent>`
- `src/app/(protected)/settings/flags/page.tsx` → render `<FlagsContent>`
- Commit: `refactor(pages): settings/flags render package components`

### T6 — Delete legacy components
- Remover `src/app/(protected)/settings/_components/settings-content.tsx`
- Remover `src/app/(protected)/settings/flags/_components/flags-content.tsx`
- Remover diretórios `_components` se ficarem vazios
- Commit: `chore: delete legacy settings/flags components`

### T7 — E2E smoke
- Criar `tests/e2e/golden-paths/settings.spec.ts` (admin project)
  - `/settings` carrega, heading visível
  - `/settings/flags` carrega, heading visível
- Commit: `test(e2e): settings + flags smoke specs`

### T8 — CI local verde
- `npm install` → verify-vendor OK
- `npx tsc --noEmit` → verde
- `npx vitest run` → verde
- `npm run build` → verde
- (sem commit; apenas gate)

### T9 — PR + merge
- Push branch
- `gh pr create --title "Frente 14b: CRM adopt @nexusai360/settings-ui" …`
- `gh pr merge --squash --admin`

### T10 — Memory update
- Editar `~/.claude/projects/…/memory/project_crm_phase_status.md` com linha Frente 14b COMPLETA.
