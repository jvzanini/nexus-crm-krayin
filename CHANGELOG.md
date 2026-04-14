# Changelog

## [2026-04-14] Frente 8 — adoção de @nexusai360/core

### Adicionado
- Dependência `@nexusai360/core@0.2.1` via vendor tarball.
- Singleton Redis configurado no boot via `instrumentation.ts` → `configureRateLimit`.
- Script `scripts/verify-vendor.mjs` + `vendor-packages/checksums.json` (SHA256 de todos os tarballs vendored).
- Hook `preinstall` valida integridade do vendor antes de qualquer install.

### Substituído
- `src/lib/rate-limit.ts` — agora wrapper de ~30 linhas que delega a `recordAttempt` + `applyProgressiveLockout` do core. Tiers idênticos (5/15min, 10/1h, 20/24h).
- `bcrypt.compare` em `src/lib/auth-helpers.ts:50` e `src/lib/actions/profile.ts:71` → `validatePassword`.
- `bcrypt.hash(_, 12)` em `src/lib/actions/profile.ts:74`, `src/lib/actions/password-reset.ts:61`, `src/lib/actions/users.ts:139` → `hashPassword` (default cost 12).

### Compatibilidade
- Hashes existentes continuam válidos — `validatePassword` usa `bcryptjs.compare` internamente (cost-agnostic).
- Chaves Redis: `lockout:<email>:<ip>` idêntica; contador muda de `attempts:<email>:<ip>` → `<email>:<ip>` (chaves antigas expiram em 60s).

### Sem mudança
- Schema Prisma, NextAuth config, UI/sidebar, email pipeline, api-keys, audit-log — frentes futuras.
