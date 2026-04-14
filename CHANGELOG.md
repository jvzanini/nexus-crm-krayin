# Changelog

## [2026-04-14] Frente 9 — adoção de @nexusai360/multi-tenant

### Adicionado
- Dependência `@nexusai360/multi-tenant@0.2.1` via vendor tarball (5 → 6 tarballs vendored).
- `src/lib/multi-tenant/adapter.ts` — `PrismaCompanyAdapter` implementando `CompanyAdapter`.
- `instrumentation.ts` registra adapter via `configureCompanies` no boot Node.

### Substituído
- `src/lib/tenant.ts` — wrapper de ~25 linhas que delega ao pacote.
- `src/lib/constants/roles.ts` — `COMPANY_ROLE_HIERARCHY`/`COMPANY_ROLE_LABELS`/`COMPANY_ROLE_OPTIONS` agora vêm do pacote.
- `src/lib/actions/company.ts` — `slugify` do pacote (função inline removida).

### Bug fix
- `COMPANY_ROLE_HIERARCHY.super_admin` agora retorna `4` (antes era `undefined` → comparações silenciosamente falhavam).

### Compatibilidade
- `CompanyRole` type idêntico (mesmos 4 valores).
- `Company.locale`, `defaultTimezone`, `baseCurrency`, `localeChangedAt`, `localeChangedBy` continuam acessíveis via `prisma.company` direto (não estão no contract do adapter).
- Operações de `delete` em `Company` continuam exigindo cascade manual (Notification, AuditLog, ApiKey, Product, UserCompanyMembership têm `onDelete: Restrict`).

### Sem mudança
- Schema Prisma, NextAuth config, UI/sidebar, queries de leads/contacts/opportunities — frentes futuras.

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
