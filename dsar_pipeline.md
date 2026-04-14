# DSAR Pipeline — Nexus CRM (Fase 12.0)

## Endpoints

- `GET /api/v1/subjects/:type/:id/export` — JSON com subject + activities + emails + consent_logs + audit_logs.
- `POST /api/v1/subjects/:type/:id/consent/revoke` — `recordConsent` com source=`dsar`; revoga marketing e tracking sem anonimizar PII.
- `POST /api/v1/subjects/:type/:id/erase` — `anonymizeSubject`: marker `[DSAR ERASED]` + email `erased-<ts>-<rand>@anon.local` + limpa PII; preserva IDs, FKs, consent_logs (compliance).

## Permissão

`dsar:execute` — apenas admin/super_admin. Definida em `src/lib/rbac/permissions.ts`.

## Auditoria

3 actions registradas em `audit_logs`: `subject.exported | subject.consent_revoked | subject.erased`.

## Implementação

- `src/lib/dsar/export.ts` — `buildSubjectExport(db, subjectType, subjectId)`.
- `src/lib/dsar/erase.ts` — `anonymizeSubject(tx, input)` — roda dentro de `prisma.$transaction`.
- `src/app/api/v1/subjects/[type]/[id]/export/route.ts`
- `src/app/api/v1/subjects/[type]/[id]/consent/revoke/route.ts`
- `src/app/api/v1/subjects/[type]/[id]/erase/route.ts`

## Por quê

LGPD art. 18 exige I (confirmação), II (acesso), VI (anonimização/eliminação). Anonimização preserva integridade FK + provas de compliance.

## Como estender

Qualquer novo subject-like (futuramente Quote) deve ser adicionado em `SUBJECT_TYPES` do `export.ts` + branch em `anonymizeSubject` em `erase.ts`.
