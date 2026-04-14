# Fase 15 — RBAC em Server Actions (follow-up Fase 1c)

**Data:** 2026-04-14
**Status:** spec v3

## 1. Contexto

Auditoria RBAC (2026-04-14):

✅ **6 arquivos com `requirePermission`:** activities, mailboxes,
marketing-campaigns, marketing-segments, products, workflows (50 checks total).

❌ **14 arquivos SEM checks:** api-keys, company, contacts, dashboard,
feature-flags, leads, locale, notifications, opportunities, password-reset,
profile, search, settings, users.

Sem RBAC, qualquer user autenticado pode executar actions críticas (criar
users, deletar empresas, mudar settings globais). Tenant scoping (Frente 17)
impede vazar *entre* tenants, mas não resolve privilege escalation *dentro*
do tenant.

## 2. Objetivo

Cobrir todas as Server Actions sensíveis com `requirePermission`, usando a
matriz `PERMISSIONS` × `ROLE_PERMISSIONS` já definida (`src/lib/rbac/permissions.ts`).

Actions excluídas do escopo (não precisam de check por design):

- `password-reset.ts` — rota pública (token-based)
- `profile.ts` — user edita próprio perfil (check de sessão basta)
- `locale.ts` — cookie do próprio user
- `search.ts` — qualquer user autenticado pode buscar
- `notifications.ts` — notifs próprias do user
- `dashboard.ts` — view consolidado (já respeita tenant-scope)
- `feature-flags.ts` — getFlags público-auth (leitura OK); só **setFlag**
  precisa `flags:manage`

Actions que PRECISAM de check:

| Arquivo | Actions | Permission |
|---|---|---|
| `api-keys.ts` | list, create, revoke | `api-keys:manage` |
| `company.ts` | getCompanies (view), create/update/delete (manage), addMember/removeMember (manage) | `companies:view` / `companies:manage` |
| `contacts.ts` | get (view), create/update/delete (create/edit/delete) | `contacts:*` |
| `leads.ts` | idem contacts | `leads:*` |
| `opportunities.ts` | idem | `opportunities:*` |
| `users.ts` | list (view), create/update/delete/addMembership/removeMembership (manage) | `users:view` / `users:manage` |
| `settings.ts` | setSetting | `settings:edit` |
| `feature-flags.ts` | setFlag | `flags:manage` |

## 3. Arquitetura

Padrão já estabelecido em products.ts:

```ts
import { requirePermission } from "@/lib/rbac";

export async function getLeads(...) {
  try {
    const user = await requirePermission("leads:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa" };
    // ... lógica
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão" };
    }
    throw err;
  }
}
```

### 3.1 Erro vs. empty result

Actions **view** devem retornar `{ success: false, error }` quando sem
permission (UI mostra toast/empty state). Actions **mutate** podem throw
`PermissionDeniedError` que o Server Action boundary propaga — Next captura
como error.

### 3.2 Granularidade

- Ações `get*`/`list*` → `<módulo>:view`
- Ações `create*` → `<módulo>:create`
- Ações `update*` → `<módulo>:edit`
- Ações `delete*` → `<módulo>:delete`
- Ações globais (addMember de company, setFlag) → `<módulo>:manage`

## 4. Testes

Unit tests para cada arquivo atualizado mockando `requirePermission`:

- caller com permission → action executa normalmente
- caller sem permission → action retorna error ou throw

Actions críticas (delete, create) têm testes existentes; adicionar um test
case "denies viewer" em cada arquivo.

## 5. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Regressão em UI onde view role antes passava | média | testar manualmente viewer → /leads; se vê lista, OK; se 500, ajustar |
| PermissionDeniedError em action não tratada → 500 | baixa | try/catch padrão em cada action; retornar `{ success: false }` |
| Performance: N+1 de `requirePermission` | baixa | call único, usa session cache |

## 6. Entregáveis

1. 8 arquivos atualizados (api-keys, company, contacts, leads, opportunities,
   users, settings, feature-flags).
2. Tests estendidos.
3. Commit único ou por arquivo (preferir por módulo — 4-5 commits).
4. Tag `phase-15-rbac-server-actions-deployed`.
