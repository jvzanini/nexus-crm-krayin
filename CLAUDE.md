# Nexus CRM

> ⚡ **AO ABRIR PROJETO EM NOVO TERMINAL / NOVA SESSÃO:** primeira leitura obrigatória é **[`docs/HANDOFF.md`](docs/HANDOFF.md)**. Ele explica o estado atual da produção, migrations pendentes, secrets a configurar, e onde continuar. Só depois siga esta CLAUDE.md.

## LEIS ABSOLUTAS

### 1. Debug de erro em produção/deploy — SEMPRE puxar logs do container PRIMEIRO

**Nunca ficar adivinhando por commits sucessivos quando prod retorna 500/erro. Puxar log real do container é o caminho mais curto para achar a causa.**

O token e URL do Portainer ficam em `.env.production` (já presente na árvore). Comando canônico:

```sh
export PTOKEN=$(grep PORTAINER_TOKEN .env.production | cut -d= -f2)
export PURL=$(grep PORTAINER_URL .env.production | cut -d= -f2)

# 1. Descobrir ID do container em execução
TASK=$(/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/tasks?filters=%7B%22service%22%3A%5B%22nexus-crm-krayin_app%22%5D%7D")
CID=$(echo "$TASK" | python3 -c "import json,sys; [print(t['Status']['ContainerStatus']['ContainerID'][:12]) for t in json.load(sys.stdin) if t['Status']['State']=='running'][0:1]")

# 2. Ler logs (stdout + stderr + timestamps)
/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/containers/$CID/logs?stdout=1&stderr=1&tail=400&timestamps=1" \
  | tail -200
```

**Quando aplicar (ordem de precedência):**

1. **Antes de qualquer novo commit de fix** quando prod retorna 500/erro opaco após build+deploy aparentemente bem-sucedido.
2. **Antes de criar debug endpoints `/api/debug/*`** como `renderToStaticMarkup` probes — logs do container mostram o erro real primeiro; debug endpoint é complemento se logs insuficientes.
3. **Após cada rollout novo** quando a causa anterior não foi identificada — reler logs, olhar timestamps alinhados com o push.
4. Vale também para: worker do BullMQ (`nexus-crm-krayin_worker`), DB (`nexus-crm-krayin_db`), Redis (`nexus-crm-krayin_redis`) — basta trocar o nome do serviço no filtro.

**Anti-padrão:** commits especulativos em sequência tentando adivinhar causa. Se já há 2 pushes sem resolver, parar e buscar logs.

**Exemplo real (2026-04-14):** perdemos ~4h com fixes especulativos (Sentry, TS types, DS transpilePackages) para um bug de dual-React instance. Logs do container mostraram em 5 segundos:
> `TypeError: Cannot read properties of null (reading 'useContext')` → dual React → fix via `webpack alias`.

### 2. Skills superpowers são obrigatórias

Ver seção "Skills Obrigatórias" abaixo — `brainstorming → writing-plans → subagent-driven-development → verification-before-completion`.

### 3. UI/UX sempre via `ui-ux-pro-max`

Ver seção "Skills Obrigatórias".

### 4. SEMPRE consultar `nexus-blueprint` antes de novos componentes/módulos

**Para toda nova implementação** (componente, seção, módulo, feature, fluxo
de UX, integração), **primeira ação = ler o blueprint**:

```
/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/
├── core/
│   ├── design-system.md      ← cores, espaçamentos, tipografia, tokens
│   ├── database.md           ← padrões Prisma, migrations, conventions
│   ├── deploy.md             ← CI/CD, Portainer, GHCR
│   └── overview.md
├── patterns/                 ← padrões reutilizáveis (dashboard, settings,
│   │                           queue, outbox, webhook-routing, reference-index)
├── modules/                  ← módulos canônicos (api-keys, audit-log,
│   │                           multi-tenant, notifications, encryption,
│   │                           search, toast, realtime, billing, onboarding)
├── architecture.md
├── integration-map.md
└── registry.json
```

**Por quê:** garantir consistência entre projetos Nexus (CRM, Roteador Webhook,
outros). Componentes, botões, cards, cores e espaçamentos devem seguir o
blueprint — ele é a fonte única de verdade. Divergência causa retrabalho e
inconsistência visual.

**Quando aplicar:**

1. Criar novo módulo/feature → ler `modules/<nome>.md` se existir, senão
   `patterns/` para achar padrão análogo.
2. Criar novo componente UI → ler `core/design-system.md` para tokens
   (cores, spacing, typography) + `patterns/dashboard.md` ou `settings.md`
   para estrutura.
3. Decisão arquitetural (DB, queue, webhook, etc.) → consultar `patterns/`
   + `core/database.md` + `architecture.md`.
4. Ao discordar do blueprint, documentar o porquê no spec da fase —
   divergência justificada OK, divergência sem motivo NÃO.

**Anti-padrão:** criar componente/módulo "do zero" ou copiando de outro
projeto sem antes ver se o blueprint já tem o padrão definido. Isso acumula
débito visual e faz cada CRM ficar "parecido-mas-diferente".

### 5. Modo autônomo total — metodologia obrigatória de fase a fase

**Sessões de desenvolvimento longo são autônomas. Não pedir aprovação,
não esperar confirmação — seguir a metodologia abaixo do início ao fim
do projeto, fase após fase, até concluir todas as opções actionable do
HANDOFF.** O usuário só interrompe se quiser mudar rumo.

#### 5.1. Ciclo obrigatório por fase

```
Brainstorm (skill superpowers:brainstorming)
  ↓
Spec v1 (writing-plans escreve spec primeiro)
  ↓
Review #1 da spec → checklist:
  • não estou esquecendo nada?
  • não estou repetindo trabalho já feito?
  • respeita identidade visual + componentes existentes (LEI #4)?
  • cobertura completa do escopo?
  ↓
Spec v2 (incorpora review #1)
  ↓
Review #2 da spec → pente fino mais profundo
  ↓
Spec v3 final (versão definitiva)
  ↓
Plan v1 (writing-plans em cima da spec v3) — TASKS BEM DETALHADAS
  ↓
Review #1 do plan → granularidade, segmentação, sem dúvidas
  ↓
Plan v2 (mais detalhado)
  ↓
Review #2 do plan → pente fino criterioso
  ↓
Plan v3 final
  ↓
Implementação (skill superpowers:executing-plans /
  subagent-driven-development) — task a task
  ↓
Testes (mesma stack: vitest, Playwright)
  ↓
verification-before-completion (skill obrigatória)
  ↓
Atualizar docs (HANDOFF.md, specs/plans, blueprint se aplicável)
  ↓
Atualizar memory (.claude/.../memory)
  ↓
Commits (português, conventional)
  ↓
Deploy (push main → CI → Portainer rollout)
  ↓
Monitorar CI + smoke prod (`/api/health`, `/login`)
  ↓
PRÓXIMA FASE — sem pedir confirmação
```

**Detalhes não negociáveis:**

- **Specs e plans em `docs/superpowers/specs/` e `docs/superpowers/plans/`**
  com sufixos `-v1.md`, `-v2.md`, `-v3.md` (manter histórico das versões).
- **Quanto mais tasks no plan, melhor.** Granularidade alta evita ambiguidade.
- **UI/UX SEMPRE via `ui-ux-pro-max`** respeitando 100% identidade visual
  existente (cores, sidebar, cards `border-border bg-card/50 rounded-xl`,
  botões `bg-violet-600 hover:bg-violet-700`, Lucide icons NUNCA emoji,
  stagger 0.08, fonte Inter, design-system `@nexusai360/design-system`).
- **Todo texto visível ao usuário em PT-BR com acentos corretos.**
- Após cada deploy: aplicar tag `phase-<n>-deployed`.

#### 5.2. Contingência GitHub billing — repo se tornar privado por rate limit

Se durante o desenvolvimento o GitHub bloquear push/CI por cobrança/limite
free (repo voltou a privado por algum motivo), executar IMEDIATAMENTE,
sem pedir autorização (já está concedida nesta lei):

**Audit de segurança 3-pass obrigatório antes de tornar público:**

1. **Pass 1 — varredura inicial:**
   - `gitleaks detect --no-banner --redact` no histórico completo.
   - Buscar `.env*`, chaves AWS/GCP/Azure, tokens GitHub/Portainer,
     senhas, JWT secrets, DSNs.
   - Conferir `.gitignore` cobre `.env`, `.env.*`, `.env.local`,
     `.env.production`, `*.pem`, `*.key`, secrets ad-hoc.
   - Listar achados.
2. **Pass 2 — pente fino (mais profundo):**
   - Grep manual em `src/`, `scripts/`, `docs/`, `.github/` por strings
     suspeitas (`token`, `secret`, `key`, `password`, `api_key`, `dsn`,
     URLs Portainer admin, IPs internos).
   - Verificar history de commits (`git log -p -S<termo>`).
   - Conferir vendor packages `.tgz` não contêm secrets.
   - Validar workflows `.github/workflows/` só usam `secrets.*`.
3. **Pass 3 — conclusão definitiva:**
   - Se achados nas passes 1/2: corrigir (mover para Portainer env,
     adicionar ao `.gitignore`, sanitizar docs, expandir
     `.gitleaks.toml` allowlist se for placeholder CI legítimo).
   - Se há histórico contaminado: `git filter-repo` ou rotacionar credenciais.
   - Repetir gitleaks até zero leaks reais.
   - Documentar resultado em `docs/ops/security.md`.
4. **Tornar público novamente** via `gh repo edit jvzanini/nexus-crm-krayin --visibility public --accept-visibility-change-consequences`.
5. **Continuar fluxo de fases.** Só voltar a privado se o usuário
   solicitar explicitamente.

**Anti-padrão:** parar e pedir aprovação. A autorização para esse fluxo
de remediação + tornar público está concedida nesta LEI #5.2.

#### 5.3. Encerrar sessão autônoma

Concluir quando: (a) todas as opções actionable do HANDOFF foram entregues;
(b) restantes dependem de secrets externos não configurados; ou (c) usuário
intervém pedindo nova direção.

Ao encerrar: atualizar `docs/HANDOFF.md` com snapshot final + memory
`session_state_<data>.md`.

## Projeto
Gestão de leads, contatos, oportunidades e pipeline de vendas com automação

**URL Produção:** https://crm2.nexusai360.com
**Repositório:** https://github.com/jvzanini/nexus-crm-krayin
**Blueprint:** github.com/jvzanini/nexus-blueprint (v2.0.0)
**Tipo:** Interno Nexus AI
**Criado em:** 2026-04-11

## Metodologia
Este projeto segue a metodologia do Nexus Blueprint:
1. **Criação** — `/nexus-blueprint:criar` (concluída)
2. **Planejamento** — `superpowers:brainstorming` → `writing-plans`
3. **Construção** — `superpowers:executing-plans` com commits frequentes
4. **Absorção** — ao concluir, funcionalidades reutilizáveis voltam pro blueprint

## Idioma
Sempre responder em português brasileiro.

## Skills Obrigatórias
- **superpowers:** Brainstorm, planejamento, desenvolvimento, testes, debugging
- **ui-ux-pro-max:** OBRIGATÓRIO para TODO layout/UI — design system em `design-system/nexus-crm-krayin/MASTER.md`

## Convenções
- Commits em português
- Código e variáveis em inglês
- Comentários em português quando necessário
- Server Actions em `src/lib/actions/`
- Todo texto visível ao usuário DEVE ter acentos e caracteres PT-BR corretos

## Stack Técnica
- Next.js 16+ (App Router, Server Components, Server Actions)
- TypeScript
- Prisma v7 — imports de `@/generated/prisma/client` (NÃO `@prisma/client`)
- PostgreSQL 16 + Redis 7
- NextAuth.js v5 (JWT stateless, trustHost: true)
- Tailwind CSS 4 + shadcn/ui (base-ui) — usar `render` prop, NÃO `asChild`
- UI base: `@nexusai360/design-system` v0.3.0+ (ver seção UI Components)
- ThemeProvider customizado — dark/light/system via cookie SSR sync (**NÃO** usar next-themes)
- Framer Motion — `as const` em variants com `ease`
- Lucide React (ícones, NUNCA emojis)
- Fonte principal: Inter (via `next/font/google`) — NÃO Geist Sans

## Identidade Visual
- **Cor primária:** #6d28d9 (light) / #7c3aed (dark)
- **Logo:** `public/logo.png`
- **Temas:** Dark (padrão), Light, Sistema
- **CSS variables:** Todas as cores via CSS custom properties em globals.css

## Deploy
- **Ambiente:** Produção direta (sem staging)
- **Pipeline:** Push main → GitHub Actions (test → build → deploy automático)
- **Infraestrutura:** Docker Swarm Stack via Portainer (4 containers: app, worker, db, redis)
- **Registry:** ghcr.io/jvzanini/nexus-crm-krayin
- **Rede:** rede_nexusAI (externa)
- **Migrations:** Prisma v7 não suporta migrate deploy no runtime. Aplicar via psql direto no container db

## Módulos Incluídos
- **multi-tenant** — Empresas/workspaces com controle de acesso hierárquico em duas camadas (PlatformRole + CompanyRole)
- **notifications** — Feed de notificações in-app com badge, polling 30s e real-time SSE
- **audit-log** — Registro fire-and-forget de ações (quem fez o quê, quando, de onde)
- **toast** — Sistema de toast visual customizado (Sonner v2 + MutationObserver, pilha bottom-up)
- **encryption** — Criptografia AES-256-GCM para dados sensíveis (tokens, segredos)
- **realtime** — SSE sobre Redis Pub/Sub para atualizações em tempo real
- **api-keys** — Chaves de API com hash SHA256, scopes granulares e IP allowlist
- **search** — Busca global unificada com Ctrl+K, multi-índice e tenant scoping

## Para adicionar módulos
Invocar `/nexus-blueprint:listar` para ver módulos disponíveis.
Ler o doc do módulo no blueprint e seguir a seção "Integração".

## Regras
- Todo serviço sobe como container Docker
- Credenciais NUNCA no GitHub — apenas em `.env.production` (local)
- Ir pelo caminho mais simples e direto

## Estrutura de Actions
Todas as Server Actions ficam em `src/lib/actions/`:
- `users.ts` — CRUD usuários + memberships com controle hierárquico de acesso (exporta `UserItem` com highestRole/canEdit/canDelete/companiesCount)
- `profile.ts` — perfil do usuário (getProfile, updateProfile, updateAvatar, changePassword, requestEmailChange, updateTheme)
- `password-reset.ts` — solicitar e redefinir senha (token + email Resend)
- `company.ts` — CRUD de empresas (getCompanies, createCompany, updateCompany, deleteCompany, addMember, removeMember)
- `leads.ts` — CRUD de leads (getLeads, createLead, updateLead, deleteLead)
- `contacts.ts` — CRUD de contatos (getContacts, createContact, updateContact, deleteContact)
- `opportunities.ts` — CRUD de oportunidades (getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity)
- `notifications.ts` — feed de notificações (getNotifications, markAsRead, markAllAsRead)
- `settings.ts` — configurações globais (getAllSettings, setSetting) — key-value individual
- `api-keys.ts` — gerenciamento de chaves de API
- `search.ts` — busca global unificada
- `dashboard.ts` — métricas com filtro por período, comparison, chart agregado, atividades recentes paginadas

## Domínio CRM
- **Lead** — Potencial cliente (status: new, contacted, qualified, unqualified, converted)
- **Contact** — Contato já qualificado com histórico de interações
- **Opportunity** — Oportunidade de negócio vinculada a contato (stages do pipeline)
- **Pipeline** — Visualização kanban de oportunidades por stage

## Status das Telas (atualizado 2026-04-13)
- **Sidebar** — ✅ Logo imagem + subtítulo CRM + role no user info
- **Dashboard** — ✅ Dados reais, NotificationBell, filtros período, stats cards, gráfico, atividades recentes
- **Perfil** — ✅ Server/client separados, 4 cards (avatar, email, senha, aparência)
- **Usuários** — ✅ Rewrite completo com BadgeSelect inline, CRUD dialogs, permissões
- **Empresas** — ✅ CRUD funcional com tabela, create/edit/delete
- **Leads** — ✅ Tabela CRUD com filtros de status
- **Contatos** — ✅ Tabela CRUD
- **Oportunidades** — ✅ Tabela CRUD com valor R$ e stage badges
- **Configurações** — ✅ Saves funcionais com getAllSettings/setSetting

## Documentação
- **Spec correção visual:** `docs/superpowers/specs/2026-04-13-correcao-visual-crm-design.md`
- **Plano correção visual:** `docs/superpowers/plans/2026-04-13-correcao-visual-crm.md`

## UI Components
A partir de 2026-04-14 (Fase 1a), componentes base de UI vêm de `@nexusai360/design-system` v0.3.0+.
Imports: `import { Button, Card, Dialog, Skeleton, AppShell, PageHeader, ... } from "@nexusai360/design-system"`.
CSS global importado em `src/app/layout.tsx` (`@nexusai360/design-system/styles.css` antes de `./globals.css`).
Componentes específicos do CRM (ex: Popover, Checkbox custom) continuam em `src/components/ui/`.
Flag `DS_V3_ENABLED` (default true) permite kill-switch em runtime; `DS_PREVIEW=true` habilita rota `/__ds-preview` para QA visual (gated em middleware — 404 quando desligada).

## Padrão Visual (referência canônica)
Todas as telas devem seguir 1:1 o padrão do Roteador Webhook (`/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/`).
- Ícones: Lucide React, NUNCA emoji
- Cards: `border-border bg-card/50 rounded-xl`
- Botões primários: `bg-violet-600 hover:bg-violet-700`
- Animações: containerVariants/itemVariants stagger 0.08
- Tabelas: shadcn Table com hover states, motion.tr row stagger
- Dialogs: Dialog para create/edit, AlertDialog para delete
- Inputs: `bg-muted/50 border-border text-foreground`
