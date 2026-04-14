# Spec — Frente 17: Tenant Scoping em leads/contacts/opportunities

**Data:** 2026-04-14
**Status:** v3 (compactado inline; review via code-reviewer no PR)

## Contexto

A Frente 9 adotou `@nexusai360/multi-tenant` para roles/memberships, mas o schema
dos domínios core (`Lead`, `Contact`, `Opportunity`) **não possui** coluna
`companyId`. Comentários no código (`leads/[id]/activities/page.tsx` e pares)
reconhecem: "Lead/Contact/Opportunity ainda não têm companyId no schema
(tenant scope enforced em Server Actions via session.membership)".

Na prática, **não havia enforcement**: server actions como `getLeads`,
`deleteContact(id)`, `updateOpportunity(id, …)` nunca filtravam por tenant —
qualquer usuário autenticado podia ler/editar/apagar linhas de qualquer
company. **Isso é um vazamento cross-tenant em produção.**

## Escopo

1. **Schema**: adicionar `companyId String @db.Uuid` com FK → `Company`,
   `onDelete: Restrict`, `@@index([companyId, createdAt(sort: Desc)])` em
   `Lead`, `Contact`, `Opportunity`. Migration Prisma com backfill:
   `UPDATE leads SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)`
   (decisão autônoma: primeiro company existente herda as linhas legacy;
   deploys novos não têm dados, seeds recriam). Depois `SET NOT NULL`.

2. **Helper** `src/lib/tenant-scope.ts`:
   - `requireActiveCompanyId(): Promise<string>` — resolve via
     `getCurrentUser()` + primeira membership ativa; throw `"no_active_company"`.
   - `getTenantWhere(activeCompanyId, user): { companyId } | {}` — reusa
     `buildTenantFilter` do pacote quando user é super_admin; caso contrário
     restringe ao companyId ativo. Compatível com `spread` em `where`.

3. **Callsites refatorados** (inventário completo):

   | Arquivo | Queries |
   |---|---|
   | `src/lib/actions/leads.ts` | `getLeads` findMany, `createLead` create (+companyId), `updateLead` update via AND, `deleteLead` delete via AND |
   | `src/lib/actions/contacts.ts` | `getContacts` findMany, `createContact` create, `updateContact` update AND, `deleteContact` delete AND |
   | `src/lib/actions/opportunities.ts` | `getOpportunities` findMany, `createOpportunity` create, `updateOpportunity` update AND, `deleteOpportunity` delete AND |
   | `src/lib/actions/search.ts` | `search` — filtrar leads/contacts/opportunities por companyId |
   | `src/app/api/search/route.ts` | mesmo da acima (route handler) |
   | `src/lib/actions/activities.ts` | `findFirst` em lead/contact/opportunity ao validar subject — filtrar por companyId |
   | `src/app/(protected)/leads/[id]/activities/page.tsx` | `findFirst` já tem `where:{id}` — adicionar companyId |
   | `src/app/(protected)/contacts/[id]/activities/page.tsx` | idem |
   | `src/app/(protected)/opportunities/[id]/activities/page.tsx` | idem |
   | `src/lib/actions/dashboard.ts` | count/findMany — todos com `{ companyId }` no where |
   | `src/lib/actions/marketing-segments.ts` | `prisma.contact.count/findMany` — adicionar companyId |
   | `src/lib/actions/marketing-campaigns.ts` | `prisma.contact.findMany` — idem |
   | `src/lib/worker/processors/marketing-send.ts` | `prisma.contact.findUnique` → migrar para `findFirst` com companyId (campaign já tem companyId) |
   | `src/lib/automation/actions/update-field.ts` | `updateMany({where:{id}})` → adicionar companyId |
   | `src/lib/automation/actions/assign-user.ts` | idem |

4. **Pattern**:
   ```ts
   // find/count
   where: { companyId: activeCompanyId, /* demais filtros */ }
   // create
   data: { companyId: activeCompanyId, ... }
   // update/delete por id
   where: { id_companyId: ??? } // Prisma não aceita composite sem @@id
   // usar updateMany/deleteMany com where:{ id, companyId } retornando count
   ```
   Como `id` é UUID único global, adotamos `updateMany`/`deleteMany` com
   `where: { id, companyId }` e checagem de `count > 0` para 404/403.

5. **Testes**:
   - Unit: `leads.test.ts`, `contacts.test.ts`, `opportunities.test.ts` com
     Prisma mock via `vi.mock("@/lib/prisma")`. Um teste por action
     validando que o `where`/`data` inclui o companyId correto e que
     update/delete cross-tenant retorna 0 rows (erro).
   - Integração skipada se DB não disponível (padrão Vitest `describe.skipIf`).

6. **Exceções cross-tenant autorizadas**: busca global (`search`) para
   super_admin permanece sem filter, guardado por `user.isSuperAdmin`.

## Decisões autônomas

- Backfill pragmático: primeira company existente (`ORDER BY created_at ASC LIMIT 1`)
  recebe dados legacy. Ambientes de dev rodam seed; prod não tem dados
  nesses domínios ainda (Frentes 8-16 adicionaram scaffolding mas nenhum
  tenant real criou leads). Aceitável.
- `updateMany`/`deleteMany` por id — Prisma não tem `update by unique + filter`
  elegante; count=0 ⇒ 404 "not_found_or_forbidden".
- `@nexusai360/multi-tenant` publicado já expõe `buildTenantFilter`, mas
  sua forma é `{ companyId: { in: [...] } }`. Para os casos single-company
  ativo usamos formato simples; para super_admin (sem filter) reusamos o pacote.

## Fora de escopo

- Refatorar `resolveActiveCompanyId` pre-existente em leads.ts/contacts.ts
  (mantém lógica, apenas centraliza em helper novo).
- E2E com 2 tenants — deixado para Frente posterior; unit cobre enforcement.
- Domínios Products/Activities/Mailbox — já tinham companyId desde início.
