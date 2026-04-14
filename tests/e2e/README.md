# E2E Tests — Playwright

## Estrutura de projects

- `setup` — `tests/e2e/auth.setup.ts`. Roda 1x antes do project `authenticated`. Faz login via UI e salva `storageState` em `.auth/user.json`.
- `unauth` — specs que NÃO precisam de sessão: `ds-preview`, `users-redirect`, `companies-redirect`.
- `authenticated` — specs em `tests/e2e/authenticated/`. Reutilizam `storageState` salvo pelo setup.

## Pré-requisitos para rodar localmente

1. Postgres rodando: `docker-compose up -d`.
2. Schema aplicado: `pnpm prisma migrate deploy`.
3. Seed executado:
   ```bash
   ADMIN_EMAIL=admin@nexus.local ADMIN_PASSWORD=admin123 pnpm prisma db seed
   ```
4. (Opcional) Redis local para evitar lockout em retries.

## Comandos

```bash
# Tudo (setup + unauth + authenticated)
pnpm playwright test

# Só os specs antigos (sem precisar de DB)
pnpm playwright test --project=unauth

# Só os autenticados (depende do setup)
pnpm playwright test --project=authenticated
```

## CI sem DB

Setar `SKIP_AUTH_E2E=true` desabilita o project `authenticated` e seu setup dependency. CI workflows que não tenham service de Postgres devem setar essa env var.

## Credenciais E2E

`auth.setup.ts` lê (em ordem de prioridade):
1. `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`
2. `ADMIN_EMAIL` / `ADMIN_PASSWORD`
3. Fallback: `admin@nexus.local` / `admin123` (apenas dev)
