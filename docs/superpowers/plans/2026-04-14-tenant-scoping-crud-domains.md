# Plan — Frente 17: Tenant Scoping em leads/contacts/opportunities

**Data:** 2026-04-14
**Status:** v3 compactado

## Tasks

### T1. Migration schema + helper
- Editar `prisma/schema.prisma`: `companyId` em `Lead`, `Contact`, `Opportunity`.
- Criar `prisma/migrations/20260424000000_tenant_scope_crud/migration.sql`
  com `ADD COLUMN ... NULL` → `UPDATE ... SET company_id = first company`
  → `SET NOT NULL` → `ADD FOREIGN KEY` → `CREATE INDEX`.
- Criar `src/lib/tenant-scope.ts` com `requireActiveCompanyId()`.
- Regenerar Prisma client.
- Commit: `feat(schema): add companyId to lead/contact/opportunity`

### T2. Leads
- Refatorar `src/lib/actions/leads.ts`: getLeads, createLead, updateLead, deleteLead.
- Adicionar `src/lib/actions/leads.test.ts` (unit com prisma mock).
- Commit: `refactor(leads): apply tenant filter in all actions`

### T3. Contacts
- Refatorar `src/lib/actions/contacts.ts`.
- Adicionar `src/lib/actions/contacts.test.ts`.
- Commit: `refactor(contacts): apply tenant filter in all actions`

### T4. Opportunities
- Refatorar `src/lib/actions/opportunities.ts`.
- Adicionar `src/lib/actions/opportunities.test.ts`.
- Commit: `refactor(opportunities): apply tenant filter in all actions`

### T5. Callsites auxiliares
- search.ts + api/search/route.ts — filter por companyId (super_admin exceção).
- activities.ts (valida subject) — filter.
- dashboard.ts — filter em todos count/findMany.
- marketing-segments.ts, marketing-campaigns.ts — filter em contact queries.
- worker/processors/marketing-send.ts — findFirst com companyId da campaign.
- automation/actions/update-field.ts, assign-user.ts — filter em updateMany.
- Pages activities/[id] — adicionar companyId ao findFirst.
- Commit: `refactor(crm): tenant filter em callsites auxiliares`

### T6. Seeds
- Ajustar `prisma/seed.ts` e `prisma/seed-e2e.ts` para passar companyId ao criar leads/contacts/opportunities (se criavam).
- Commit: `chore(seed): include companyId em leads/contacts/opportunities`

### T7. CI local e PR
- `npx tsc --noEmit` (tolerar erros pré-existentes conhecidos).
- `npx vitest run` para os novos testes.
- Push, PR, squash merge admin.
