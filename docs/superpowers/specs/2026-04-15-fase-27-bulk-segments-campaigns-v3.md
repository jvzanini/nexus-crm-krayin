# Spec v3 — Fase 27: Bulk Delete em Segments + Campaigns

## Escopo

- `deleteSegmentsBulkAction(ids)`: respeita FK P2003 e bloqueia segments em uso por campanhas ativas (scheduled/sending/paused). Retorna `{deletedCount, skippedInUse}`.
- `deleteCampaignsBulkAction(ids)`: permite somente status `draft|canceled|completed`. Bloqueia running/scheduled/paused/sending. Retorna `{deletedCount, skippedActive}`.
- UI: checkbox column + BulkActionBar + AlertDialog em ambos.
- RBAC: `marketing:manage` em ambos.
- Tenant scope via `companyId`.

## Riscos mitigados

- FK Campaign → Segment (Restrict): queries prévia de campanhas ativas.
- Campaign em execução: filtro de status antes do deleteMany.

## Fora de escopo

- URL filters (pode entrar em 27b).
- Bulk edit status.

## Tags

`phase-27-bulk-segments-campaigns-deployed`
