# CHANGELOG

## [2026-04-14] Frente 13 — E2E auth fixture (storageState)

### Adicionado
- `tests/e2e/auth.setup.ts` — setup project que faz login UI e salva `storageState` em `.auth/user.json`.
- `tests/e2e/authenticated/users-content.spec.ts` — smoke render de `/users` logado.
- `tests/e2e/authenticated/companies-content.spec.ts` — smoke render de `/companies` logado.
- `tests/e2e/README.md` — documentação de projects, pré-requisitos e flag `SKIP_AUTH_E2E`.
- `.gitignore` agora ignora `.auth/`.

### Modificado
- `playwright.config.ts` — reescrito com 3 projects (setup, unauth, authenticated). Project `authenticated` é skipado quando `SKIP_AUTH_E2E=true`. `snapshotPathTemplate` customizado preserva nomes de snapshot sem sufixo de project (compat com snapshots pré-Frente 13).

### Notas
- Specs autenticados requerem Postgres + seed local (`pnpm prisma db seed` com `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
- CI sem service de DB deve setar `SKIP_AUTH_E2E=true`.

### Sem mudança
- 3 specs antigos (`ds-preview`, `users-redirect`, `companies-redirect`) continuam rodando no project `unauth`.
