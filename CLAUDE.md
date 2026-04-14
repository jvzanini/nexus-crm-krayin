# Nexus CRM

> ⚡ **AO ABRIR PROJETO EM NOVO TERMINAL / NOVA SESSÃO:** primeira leitura obrigatória é **[`docs/HANDOFF.md`](docs/HANDOFF.md)**. Ele explica o estado atual da produção, migrations pendentes, secrets a configurar, e onde continuar. Só depois siga esta CLAUDE.md.

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
