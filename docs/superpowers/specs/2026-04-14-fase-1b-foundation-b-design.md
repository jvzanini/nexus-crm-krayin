# Spec: Fase 1b — Foundation B (migração de telas + consent LGPD)

**Data:** 2026-04-14
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda)
**Depende de:** Fase 1a (DS v0.3.0 publicado e integrado em `__ds-preview`).
**Gate para:** Fases 2 (Pipelines), 3 (Products), 5 (Custom Attributes), 6 (Activities), 7 (Email), 9 (Marketing).

---

## Changelog

### v2 → v3 (após Review 2 profunda)
- **Split em 1b.0/1b.1/1b.2:** 1b não é uma fase única — migração pura (1b.0), consent LGPD (1b.1), hardening (1b.2). Cada sub-fase tem aceite independente.
- **IP minimization:** inet → prefixed mask `/24` IPv4 e `/48` IPv6 (pseudonimização LGPD "princípio da necessidade").
- **Backfill explicit policy:** script `prisma/scripts/backfill-consent.ts` emite 1 log `source=backfill_migration` por registro com `granted=false` e `reason="pre-1b registro; consent pendente"`, em vez de inserir log implícito. Admin precisa re-consentir ativamente cada lead/contact legacy.
- **Kill-switch real:** `DS_V3_ENABLED=false` faz middleware servir apenas `src/components/ui/*` locais (rebuild da imagem com barrel secundário). Descartado como inviável sem custo alto; substituído por `git revert` como único rollback aceitável — documentado.
- **Visual regression threshold:** 2% → 0.1% em pixel diff (Playwright `toHaveScreenshot({ maxDiffPixelRatio: 0.001 })`); diferenças acima exigem aprovação e novo baseline.
- **i18n:** strings de consent registradas em `messages/pt-BR.json` e `messages/en.json` (chaves `consent.marketing.label`, etc.).
- **AppShell swap:** root `(protected)/layout.tsx` passa a usar `AppShell.Root/Sidebar/Content/Header/Main` do DS (descartou implementação ad-hoc atual).
- **Aceite T de consent por tenant:** sub-teste multi-tenant — tenant A não vê logs de consent de tenant B (quando Fase 1c entregar RLS; aqui verifica apenas a query filter).
- **PII redaction em logs:** `consent_logs.userAgent` truncado a 200 chars; `reason` opcional mas sanitizado (no HTML).

### v1 → v2 (após Review 1 ampla)
- Separar telas P0 (gate Fase 2) das P1 (gate Fase 6+) — prioridade numérica explícita.
- Remover `source: 'api'` (fora de escopo 1b).
- Especificar `grantedBy` semântica: NULL quando é subject opt-in via form público; UUID do admin quando é edição interna.
- Adicionar performance budget por rota (LCP < 2.5s em 3G fast; p95).
- Incluir test que legacy-peer-deps não mascara incompat runtime.
- Adicionar `docs/lgpd.md` como entregável (resumo de política, fontes legais, predicates em Fase 7/9).
- Definir lint rule `no-direct-consent-write` que proíbe `prisma.lead.update({ consentMarketing })` fora de `src/lib/consent/`.

---

## 1. Objetivo

1. **Eliminar duplicação de UI** — substituir `src/components/ui/{button,card,input,label,switch,sonner,dialog,alert-dialog,table}.tsx` por imports de `@nexusai360/design-system` em todas as rotas do CRM.
2. **Instaurar pipeline de consent LGPD** — coletar `consent_marketing` e `consent_tracking` explícitos em Leads/Contacts, com trilha de auditoria imutável (`consent_logs`) que fundamenta predicates de envio de email/tracking nas Fases 7 e 9.
3. **AppShell canônico** — layout do `(protected)` passa a usar o compound `AppShell` do DS.

## 2. Sub-fases

### 1b.0 — Migração visual pura (sem mudança funcional)
- Só imports swap + AppShell swap.
- Aceite: regressão visual ≤ 0.1% em todas as 10 rotas.

### 1b.1 — Consent LGPD
- Migration + lib + forms + logs.
- Aceite: fluxos E2E de consent passando.

### 1b.2 — Hardening
- `docs/lgpd.md` + lint rule + backfill script + i18n completo + tag `phase-1b-deployed`.

## 3. Escopo

### 3.1. Telas migradas

Ordem por prioridade:

**P0 — gate para Fase 2:**
| Rota | Imports locais hoje | Ações |
|------|---------------------|-------|
| `src/app/layout.tsx` | `Toaster` | swap |
| `(protected)/layout.tsx` (criar se não existir) | — | adotar AppShell |
| `(protected)/dashboard/page.tsx` | Card | swap |
| `(protected)/leads/*` | Button, Card, Input, Label, Table, Dialog | swap + **consent form** |
| `(protected)/contacts/*` | idem | swap + **consent form** |

**P0 — gate para onboarding:**
| `(auth)/login/page.tsx` | Button, Input, Label, Card | swap |
| `(auth)/forgot-password/page.tsx` | idem | swap |
| `(auth)/reset-password/page.tsx` | idem | swap |
| `(auth)/verify-email/page.tsx` | — (pequeno) | swap |

**P1 — gate para Fase 6+:**
| `(protected)/opportunities/*` | Button, Card, Input, Switch, Dialog, AlertDialog | swap |
| `(protected)/profile/*` | idem | swap |
| `(protected)/users/*` | idem | swap |
| `(protected)/companies/*` | idem | swap |
| `(protected)/settings/*` | idem | swap |

### 3.2. Componentes DS consumidos

Inventário atual (após `grep` das 10 rotas):
```
Button, Card (+ Header/Content/Title/Description),
Input, Label, Switch, Toaster,
AlertDialog (+ partes), Dialog (+ partes), Table (+ partes)
```

Todos já exportados pelo barrel de `@nexusai360/design-system@0.3.0`.

Adicionais usados na Fase 1b (já disponíveis no DS):
```
AppShell (+ .Sidebar/.Content/.Header/.Main), PageHeader, Breadcrumb, EmptyState, ErrorState
```

### 3.3. Componentes locais mantidos

Não migrados (sem equivalente em v0.3.0; agendados para Fase 1d em v0.4.0):
- `src/components/ui/popover.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/custom-select.tsx`
- `src/components/ui/badge.tsx` (se existir — checar; se não, nota N/A)

Explicitamente mantidos = sem deprecation warning em 1b. Deprecation entra em 1d.

### 3.4. Consent LGPD

#### 3.4.1. Schema Prisma

Migration `20260415000000_add_consent_to_leads_contacts_and_consent_logs`:

```prisma
model Lead {
  // ... campos existentes
  consentMarketing        Boolean   @default(false) @map("consent_marketing")
  consentMarketingAt      DateTime? @map("consent_marketing_at")
  consentMarketingIpMask  String?   @map("consent_marketing_ip_mask")  // 192.168.0.0/24 ou IPv6/48
  consentTracking         Boolean   @default(false) @map("consent_tracking")
  consentTrackingAt       DateTime? @map("consent_tracking_at")
  consentTrackingIpMask   String?   @map("consent_tracking_ip_mask")
}

model Contact {
  // mesmos 6 campos
}

model ConsentLog {
  id           String   @id @default(uuid()) @db.Uuid
  subjectType  String   @map("subject_type")     // 'lead' | 'contact'
  subjectId    String   @map("subject_id") @db.Uuid
  consentKey   String   @map("consent_key")      // 'marketing' | 'tracking'
  granted      Boolean
  grantedBy    String?  @map("granted_by") @db.Uuid   // null se subject self-service
  grantedAt    DateTime @default(now()) @map("granted_at")
  ipMask       String?  @map("ip_mask")          // máscara, não IP completo
  userAgent    String?  @map("user_agent") @db.VarChar(200)
  source       String                            // 'lead_form' | 'contact_form' | 'admin_edit' | 'backfill_migration'
  reason       String?  @db.VarChar(500)
  @@index([subjectType, subjectId, consentKey, grantedAt(sort: Desc)], name: "idx_consent_log_subject_key_time")
  @@map("consent_logs")
}
```

#### 3.4.2. UI (forms de Lead/Contact)

Bloco "Consentimentos (LGPD)" dentro do form:
```tsx
<fieldset aria-labelledby="consent-legend" className="space-y-3">
  <legend id="consent-legend" className="text-sm font-medium">
    {t('consent.legend')}
  </legend>
  <label className="flex items-start gap-2">
    <Checkbox
      checked={marketing}
      onCheckedChange={setMarketing}
      aria-describedby="marketing-hint"
    />
    <span>
      <span className="font-medium">{t('consent.marketing.label')}</span>
      <span id="marketing-hint" className="block text-xs text-muted-foreground">
        {t('consent.marketing.hint')}
      </span>
    </span>
  </label>
  {/* idem tracking */}
  <p className="text-xs text-muted-foreground">
    {t('consent.disclosure')} <a href="/privacy">{t('consent.policyLink')}</a>
  </p>
</fieldset>
```

Checkbox vem de `src/components/ui/checkbox.tsx` (local, em 1b; migra em 1d).

#### 3.4.3. Biblioteca central

`src/lib/consent/index.ts`:

```ts
import type { PrismaClient, Prisma } from '@prisma/client';

export type ConsentKey = 'marketing' | 'tracking';
export type ConsentSource = 'lead_form' | 'contact_form' | 'admin_edit' | 'backfill_migration';
export type SubjectType = 'lead' | 'contact';

export interface RecordConsentInput {
  subjectType: SubjectType;
  subjectId: string;
  consent: Record<ConsentKey, boolean>;
  source: ConsentSource;
  ipMask?: string | null;
  userAgent?: string | null;
  grantedBy?: string | null;
  reason?: string | null;
}

/** Grava diffs em consent_logs + atualiza denormalizados no subject. Idempotente. */
export async function recordConsent(
  tx: Prisma.TransactionClient,
  input: RecordConsentInput,
): Promise<{ changes: ConsentKey[] }>;

/** Estado ativo mais recente. */
export async function getActiveConsent(
  db: PrismaClient | Prisma.TransactionClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<Record<ConsentKey, { granted: boolean; at: Date | null; source: ConsentSource | null }>>;

/** Predicate usado por Fase 7 (tracking) e Fase 9 (marketing). */
export async function canSendMarketing(db: PrismaClient, contactId: string): Promise<boolean>;
export async function canTrackOpen(db: PrismaClient, contactId: string): Promise<boolean>;

/** Util p/ mascarar IP (LGPD minimization). */
export function maskIp(ip: string): string;
```

Regras:
- `recordConsent` compara `input.consent[key]` com último log do mesmo `(subject, key)`. Se igual, skip (idempotência). Se diferente, insere log + atualiza denormalizados.
- `maskIp`: IPv4 → `/24`, IPv6 → `/48`, entrada inválida → `null`.
- Toda escrita em `Lead.consentMarketing` / `Contact.consentTracking` **deve** passar por `recordConsent`. Enforced por ESLint rule `@nexus-crm/no-direct-consent-write`.

#### 3.4.4. Server Actions

`src/server/actions/lead.ts` (e análogo contact):

```ts
'use server';

import { headers } from 'next/headers';
import { recordConsent, maskIp } from '@/lib/consent';

export async function createLeadAction(raw: unknown) {
  const parsed = createLeadSchema.parse(raw);
  const session = await auth();
  requireRole(session, ['admin', 'manager', 'seller']);

  const h = await headers();
  const ipMask = maskIp(h.get('x-forwarded-for')?.split(',')[0] ?? '');
  const ua = (h.get('user-agent') ?? '').slice(0, 200) || null;

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        ...parsed.fields,
        consentMarketing: parsed.consent.marketing,
        consentMarketingAt: parsed.consent.marketing ? new Date() : null,
        consentMarketingIpMask: parsed.consent.marketing ? ipMask : null,
        consentTracking: parsed.consent.tracking,
        consentTrackingAt: parsed.consent.tracking ? new Date() : null,
        consentTrackingIpMask: parsed.consent.tracking ? ipMask : null,
      },
    });
    await recordConsent(tx, {
      subjectType: 'lead',
      subjectId: lead.id,
      consent: parsed.consent,
      source: 'lead_form',
      ipMask,
      userAgent: ua,
      grantedBy: session.user.id,
    });
    return lead;
  });
}
```

Zod schema **obriga presença** de `consent.marketing` e `consent.tracking` (no default implícito). Falta do campo = erro.

### 3.5. Regressão visual

- **Pré-migração:** spec `tests/e2e/screens-baseline.spec.ts` captura screenshots das 10 rotas em 3vp (390/768/1440) × 2 temas (dark/light) = 60 baselines, commitadas antes do swap.
- **Pós-migração:** mesmo spec; diff ≤ 0.1% (`maxDiffPixelRatio: 0.001`).
- Divergências intencionais: commit separado de nova baseline com justificativa no body do commit.

### 3.6. Acessibilidade

- `tests/e2e/a11y-screens.spec.ts`: axe run em 10 rotas × 3vp × 2 temas. 0 critical/serious.
- Lighthouse a11y ≥ 95 por rota (verificado no `crm-a11y.yml`).
- Screen-reader smoke em **duas** rotas representativas (Leads + Login) com `@guidepup/playwright` — fallback manual se CI não suporta.

### 3.7. Performance budgets

Por rota em condição 3G fast (Lighthouse emulation):
- LCP p95 < 2.5s
- CLS < 0.1
- TBT < 300ms
- Bundle JS inicial (client) < 170KB gz por rota (delta < 10% vs pré-1b)

### 3.8. i18n

- `messages/pt-BR.json` e `messages/en.json` recebem namespace `consent`:
  ```json
  "consent": {
    "legend": "Consentimentos (LGPD)",
    "marketing": { "label": "...", "hint": "..." },
    "tracking": { "label": "...", "hint": "..." },
    "disclosure": "...",
    "policyLink": "..."
  }
  ```
- Spec obriga ambas as locales sync (não aceita merge com uma locale vazia).

### 3.9. Fora de escopo

- Rescrita de IA ou redesign.
- Adicionar Popover/Checkbox/Select ao DS (→ Fase 1d, v0.4.0).
- Endpoints DSAR (export/delete) — Fase 12.
- Consent via API pública — Fase 11b.
- Import CSV com consent — Fase 10.
- Renomear rotas.
- Upgrade `lucide-react@^0.468` → `^1` (continua `--legacy-peer-deps` até 1d).

## 4. Arquitetura

### 4.1. Camadas

```
┌───────────────────────────────────────────────────────┐
│ src/app/**                                            │  imports swap + consent fieldset
├───────────────────────────────────────────────────────┤
│ src/components/ui/{popover,checkbox,custom-select}.tsx│  HOLD (migra em 1d)
│ src/components/ui/{button,card,input,label,switch,    │  DELETE
│   sonner,dialog,alert-dialog,table}.tsx               │
├───────────────────────────────────────────────────────┤
│ src/server/actions/{lead,contact}.ts                  │  consent flow integrado (tx)
├───────────────────────────────────────────────────────┤
│ src/lib/consent/                                      │  novo (recordConsent, getActive, maskIp, predicates)
├───────────────────────────────────────────────────────┤
│ src/lib/consent/eslint-rule.ts                        │  novo — lint contra escrita direta
├───────────────────────────────────────────────────────┤
│ prisma/migrations/YYYYMMDD_add_consent/               │  DDL
│ prisma/scripts/backfill-consent.ts                    │  1 log por registro legacy
├───────────────────────────────────────────────────────┤
│ docs/lgpd.md                                          │  política + predicates doc
└───────────────────────────────────────────────────────┘
```

### 4.2. Fluxo de dados (happy path criar lead com opt-in marketing)

1. Usuário preenche form, marca marketing, submit.
2. Server Action recebe `{ fields, consent: { marketing: true, tracking: false } }`.
3. Zod valida presença dos 2 campos.
4. Auth + role check.
5. `headers()` → `x-forwarded-for` → `maskIp()` → `ipMask`.
6. Transaction:
   - `prisma.lead.create` com denormalizados.
   - `recordConsent(tx, ...)` grava 2 logs (marketing=true, tracking=false) com `source='lead_form'`.
7. Return lead ID. Redirect.

### 4.3. Fluxo de dados (predicate em Fase 9 — sem mudança aqui, mas especificado)

1. Marketing campaign service: `canSendMarketing(db, contactId)` antes de enfileirar email.
2. `canSendMarketing` → `getActiveConsent(db, 'contact', contactId).marketing.granted`.
3. Se false, pula; log.

## 5. Testes

### 5.1. Unit (vitest)

- `maskIp`: IPv4, IPv6, inválido.
- `recordConsent`: escreve log + denormalizado; idempotência (mesmo estado, no log adicional); mudança parcial (marketing muda, tracking igual → 1 log, não 2).
- `getActiveConsent`: retorna mais recente.
- Zod schema: rejeita payload sem chave consent.

### 5.2. Integração (vitest + test db)

- `createLeadAction`: transação rollback se `recordConsent` lança.
- `updateLeadAction`: muda só marketing → 1 log (não 2).
- Multi-tenant sanity: query `findMany` em `consent_logs` com WHERE `subjectId` não leaka outro tenant (pré-RLS; assumir scope por session.companyId em Fase 1c).

### 5.3. E2E (Playwright)

- `auth-flow.spec.ts`: login/forgot/reset/verify ainda funcionam.
- `leads-consent.spec.ts`: criar lead opt-in/opt-out; editar e mudar; verificar UI mostra estado.
- `contacts-consent.spec.ts`: idem.
- `screens.spec.ts`: visual regression 10 rotas × 3vp × 2 temas.
- `a11y-screens.spec.ts`: axe.

### 5.4. Lint

- Nova regra: `@nexus-crm/no-direct-consent-write` — AST scan: `prisma.lead.update`/`.create` com objeto que contém `consentMarketing`/`consentTracking` fora de `src/lib/consent/` ou `src/server/actions/` falha.

## 6. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Migration DB falha em prod | Muito alto | Migration `down` script; dry-run em staging dump; transação DDL. |
| Backfill grava default errado | Muito alto | Script separado `backfill-consent.ts` com `source='backfill_migration'` + `granted=false` + reason clara; idempotente. |
| Diff visual inesperado > 0.1% | Alto | Baseline pré-migração commitada; review humano obrigatório em divergências. |
| IP armazenamento viola minimização | Alto | `maskIp()` antes de persistir; nunca guardar IP inteiro. |
| Fases 7/9 esquecerem `canSendMarketing` | Alto | Predicate único; `docs/lgpd.md` + PR checklist + teste E2E na Fase 9 falha se ignorar. |
| Peer dep drift piora | Médio | `--legacy-peer-deps` mantido; 1d faz upgrade audit. |
| i18n esquecer chave em EN/PT | Médio | Test `i18n.spec.ts` compara keys entre arquivos. |
| Kill-switch inviável em prod | Alto | Rollback = `git revert` + redeploy (documentado). Sem flag runtime. |
| Usuário admin edita lead sem atualizar consent | Médio | Form sempre carrega estado atual e reenvia; server compara. |
| Performance budget estoura em tela migrada | Médio | Lighthouse CI em `/` e `/dashboard` + `/leads`; falha build se regredir > 10%. |

## 7. Aceite (1b.0 + 1b.1 + 1b.2)

### 1b.0
- `grep -rE "from \"@/components/ui/(button|card|input|label|switch|sonner|dialog|alert-dialog|table)\"" src/app | wc -l` = 0.
- `src/app/(protected)/layout.tsx` usa `AppShell.Root/Sidebar/Content/Header/Main`.
- Playwright screens.spec verde com baselines novas.
- Lint passa sem warnings.

### 1b.1
- Migration aplicada em staging; `SELECT COUNT(*) FROM consent_logs` refletindo backfill.
- E2E consent specs verdes.
- Lint rule `no-direct-consent-write` ativa (falha se violada).
- Predicates `canSendMarketing`/`canTrackOpen` exportados (mesmo que ainda não consumidos).

### 1b.2
- `docs/lgpd.md` commitado.
- Tag git `phase-1b-deployed`.
- Imagem Docker no GHCR com `:phase-1b-deployed` alias.
- Portainer rollout (se URL alcançável) ou manual registrado no memory/reference_deploy_portainer.md.
- Appendix A do roadmap: linhas "Telas migradas para DS" e "Consent LGPD Leads/Contacts" marcadas `parity`.
- 4+ memory files novos: padrão consent, ipMask policy, visual regression threshold, componentes legacy pendentes para 1d.

## 8. Rollback

1. `git revert` do merge da Fase 1b. Redeploy.
2. Migration: `prisma migrate resolve --rolled-back` + script `DROP COLUMN ... / DROP TABLE consent_logs` (fornecido como `down.sql`).
3. Se imagem já em prod mas bug crítico: tag `phase-1a-deployed` → Portainer redeploy para imagem anterior.

Sem kill-switch runtime. Decisão v3: flag seria custosa (requer dual bundle) e o risco não justifica.

## 9. Convenção de commits

- `feat(crm): migrate <route> to @nexusai360/design-system`
- `feat(crm): consent LGPD schema + library`
- `feat(crm): consent LGPD ui (leads/contacts)`
- `chore(crm): appshell swap em (protected)/layout`
- `docs(crm): docs/lgpd.md`
- `test(crm): baseline visual 10 rotas`
- `chore(crm): release fase 1b (tag phase-1b-deployed)`

## 10. Dependências externas

- Nenhuma nova lib — tudo em deps já declaradas (Prisma, Zod, Playwright, Lighthouse CI).
- ESLint custom rule fica em `src/lib/consent/eslint-rule.ts` e é declarada em `.eslintrc.cjs` do CRM (local, sem publicar).
