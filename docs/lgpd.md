# LGPD — Política de Consent, Trilha de Auditoria e Predicates

**Status:** vigente desde Fase 1b (2026-04-14)
**Owner técnico:** plataforma Nexus CRM

Este documento consolida a estratégia de **consent explícito** (Lei Geral de Proteção de Dados — Lei 13.709/2018) no Nexus CRM e serve de contrato para fases futuras de email marketing (Fase 7) e automação (Fase 9).

---

## 1. Base legal

| Categoria | Base legal (art. 7º LGPD) | Comentário |
|-----------|---------------------------|------------|
| Cadastro operacional de Lead/Contact | Legítimo interesse (IX) | Dados mínimos para execução da relação comercial. |
| Envio de comunicação de marketing | **Consentimento** (I) | Obrigatório opt-in explícito; revogável a qualquer momento. |
| Tracking de abertura/clique em e-mail | **Consentimento** (I) | Tratado separadamente de marketing. |
| Obrigação legal (nota fiscal, etc.) | Cumprimento de obrigação legal (II) | Fora do escopo deste doc — ver módulo fiscal. |

**Princípios aplicados:** finalidade, necessidade, adequação, minimização (IP mascarado), transparência (link para política), segurança (log imutável), não discriminação.

---

## 2. Modelo de dados

### 2.1. Denormalizados em `leads` e `contacts`

Permitem consultas rápidas sem scan no log:

```
consent_marketing            BOOLEAN    DEFAULT FALSE
consent_marketing_at         TIMESTAMP
consent_marketing_ip_mask    TEXT       -- /24 ou /48
consent_tracking             BOOLEAN    DEFAULT FALSE
consent_tracking_at          TIMESTAMP
consent_tracking_ip_mask     TEXT
```

### 2.2. Trilha imutável `consent_logs`

Toda mudança de estado gera um registro; a tabela é **append-only** do ponto de vista da aplicação (sem `UPDATE`/`DELETE` de produção).

Schema resumido:

| Coluna | Tipo | Nota |
|--------|------|------|
| id | UUID PK | |
| subject_type | `'lead' \| 'contact'` | |
| subject_id | UUID | |
| consent_key | `'marketing' \| 'tracking'` | |
| granted | BOOL | |
| granted_by | UUID? | admin quando edição interna; NULL quando self-service |
| granted_at | TIMESTAMP | |
| ip_mask | TEXT? | pseudonimizado /24 ou /48 |
| user_agent | VARCHAR(200)? | truncado |
| source | TEXT | `lead_form \| contact_form \| admin_edit \| backfill_migration` |
| reason | VARCHAR(500)? | sanitizado (sem HTML) |

Índice principal: `(subject_type, subject_id, consent_key, granted_at DESC)`.

---

## 3. Fluxo de gravação

Toda escrita de consent **deve** passar por `recordConsent(tx, input)` (em `src/lib/consent/`):

1. Compara estado desejado com o último log da tupla `(subject, key)`.
2. Se igual → **skip** (idempotência).
3. Se diferente → insere log + atualiza denormalizados na mesma transação.

A ESLint rule `nexus-crm/no-direct-consent-write` barra bypass: escrita direta em `consent_marketing*`/`consent_tracking*` fora de `src/lib/consent/**` ou `src/lib/actions/**` falha build.

### 3.1. Minimização de IP

`src/lib/consent/mask-ip.ts` aplica:
- IPv4 → prefixo `/24` (`203.0.113.42` → `203.0.113.0/24`).
- IPv6 → prefixo `/48` (`2001:db8:abc::1` → `2001:db8:abc::/48`).
- Entrada inválida → `null`.

Nunca armazenamos o IP completo.

### 3.2. User agent

Truncado a 200 caracteres em `consent_logs.user_agent` para limitar correlação com dispositivo.

---

## 4. Predicates de envio (consumidos pelas Fases 7/9)

Toda camada de automação deve chamar os predicates antes de enfileirar:

```ts
import { canSendMarketing, canTrackOpen } from "@/lib/consent";

if (!(await canSendMarketing(prisma, contactId))) return;         // Fase 9
if (!(await canTrackOpen(prisma, contactId))) skipPixel = true;   // Fase 7
```

Os predicates leem o denormalizado (O(1)) porque ele é sincronizado com o último log pela `recordConsent`. A tabela de logs é consultada apenas para trilha de auditoria e DSAR.

---

## 5. Backfill de registros pré-1b

Script `prisma/scripts/backfill-consent.ts` gera 1 log por Lead/Contact legado:
- `source = 'backfill_migration'`
- `granted = false`
- `reason = 'Registro pré-1b; consent pendente'`

Admin deve re-consentir ativamente cada registro legacy via tela de edição (gera log com `source='admin_edit'` ou novo `lead_form`/`contact_form` quando coletado do próprio titular).

**Idempotência:** o script verifica `consent_logs` antes de inserir; pode ser rodado múltiplas vezes.

---

## 6. DSAR (Data Subject Access Requests) — Fase 12

Os endpoints abaixo **serão** entregues na Fase 12. Contrato antecipado aqui para que o design respeite:

| Endpoint | Objetivo |
|----------|---------|
| `GET  /api/v1/subjects/:type/:id/consent/history` | Retorna todos os logs (acesso art. 18, II/III). |
| `POST /api/v1/subjects/:type/:id/consent/revoke`  | Equivale a `recordConsent(granted=false)` com `source='dsar'`. |
| `POST /api/v1/subjects/:type/:id/erase`           | Anonimiza PII do subject + marca logs com `reason='erased_by_dsar'`. |

---

## 7. Retenção

| Dado | Prazo mínimo | Motivo |
|------|--------------|--------|
| Denormalizados em leads/contacts | Enquanto o registro existir | Execução da relação. |
| `consent_logs` | 5 anos após última mudança de estado daquela tupla | Prova de base legal (ônus do controlador — art. 8º §2º). |
| IPs mascarados | Idem acima | |

Expurgo automático fora de escopo da Fase 1b (agendado para Fase 12 junto com DSAR).

---

## 8. Rollback operacional

Ver §8 do `docs/superpowers/specs/2026-04-14-fase-1b-foundation-b-design.md`.

Resumo:
1. `git revert` do merge de Fase 1b + redeploy.
2. Migration down (`prisma/migrations/20260415000000_.../down.sql`) remove colunas e tabela.
3. Se já em prod e apenas hot-fix: `git revert` pontual + redeploy, **preservando** `consent_logs` (auditoria não deve ser perdida).

---

## 9. Checklist de PR (para engenheiros)

Ao abrir PR que mexa em Lead/Contact:

- [ ] Nenhuma escrita direta em `consentMarketing*`/`consentTracking*` — usar `recordConsent`.
- [ ] `pnpm lint` verde (valida a rule).
- [ ] Fluxos UI expõem os 2 consents (marketing e tracking) separadamente, com hint e link de política.
- [ ] i18n atualizado em `src/locale/packs/{br,us}/messages/consent.json`.
- [ ] Teste de integração cobrindo idempotência se mudou `recordConsent`.
- [ ] Se tocou Fase 7/9: predicate `canSendMarketing`/`canTrackOpen` chamado antes de cada envio.
