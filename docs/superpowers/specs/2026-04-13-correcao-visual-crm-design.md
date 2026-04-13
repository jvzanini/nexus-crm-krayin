# Correção Visual CRM — Spec

**Data:** 2026-04-13
**Referência canônica:** `/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/`

## Objetivo

Reescrever todas as telas do CRM para seguir **1:1** o padrão visual do Roteador Webhook, adaptando apenas o domínio (webhooks → CRM). Nenhum layout deve ser inventado — tudo copiado da referência.

---

## 1. Dashboard

**Arquivo:** `src/components/dashboard/dashboard-content.tsx`

### Problemas atuais
- Usa emoji 👋 no greeting
- Dados estáticos/mock (STATS hardcoded, MOCK_CHART)
- Sem `NotificationBell` no canto superior direito
- Sem filtros de período (Hoje / 7 dias / 30 dias)
- Sem tabela de atividades recentes
- Sem top errors/alertas equivalente
- Sem polling/realtime
- Sem skeleton loading no primeiro carregamento

### Correções (copiar do Roteador)
- Remover emoji 👋 — greeting fica "Olá, {firstName}" sem emoji
- Adicionar `NotificationBell` ao lado do greeting (flex justify-between)
- Criar `DashboardFilters` com seletor de período (Hoje/7d/30d) + botão refresh
- Criar `StatsCards` com dados reais via server action `getDashboardData()`
  - 4 cards: Leads Novos, Contatos, Oportunidades Abertas, Taxa de Conversão
  - Cada card com ícone em colored box (sem emoji), valor, delta percentual
- Criar `CrmChart` com Recharts (leads/oportunidades ao longo do tempo)
- Criar `RecentActivity` (tabela paginada com últimas ações: lead criado, contato adicionado, oportunidade movida)
- Implementar polling 60s + realtime SSE (copiar padrão do Roteador)
- Skeleton loading no primeiro carregamento (copiar exato)
- Container/item variants com stagger animation (copiar exato)
- Data formatada em PT-BR sem capitalize (copiar lógica manual de weekday/month)

### Server Action necessária
- `getDashboardData(period, page)` retornando: stats, chart data, recent activity paginada

---

## 2. Sidebar

**Arquivo:** `src/components/layout/sidebar.tsx`

### Problemas atuais
- Logo usa div com gradiente + `APP_CONFIG.shortName` em vez de imagem
- Mostra badge de role ao lado do logo (não existe no Roteador)
- Mostra email no user info bottom (Roteador mostra role label)

### Correções
- Logo: usar `<Image src="/logo.png">` com shadow roxo (copiar exato do Roteador)
- Subtítulo: "Nexus CRM" em vez de badge de role
- User info bottom: mostrar `user.role` (label do nível) em vez de email
- Manter toda a estrutura restante (busca ⌘K, nav items, tema, logout) — já está correto

---

## 3. Perfil

**Arquivo atual:** `src/app/(protected)/profile/page.tsx` (282 linhas, tudo inline)

### Problemas atuais
- Toda a lógica no page.tsx como client component (não segue padrão server/client)
- Precisa separar em page.tsx (server) + `_components/profile-content.tsx` (client)

### Correções (copiar estrutura do Roteador)
- `page.tsx`: server component que checa auth e passa props
- `_components/profile-content.tsx`: client component com 4 cards:
  1. **Informações Pessoais** — avatar upload (drag-drop, resize 128x128 WebP), nome, "Membro desde", save
  2. **E-mail** — email atual (disabled), novo email, senha atual para confirmação, botão + estado de sucesso com checkmark
  3. **Alterar Senha** — senha atual, nova senha, confirmar nova, eye/eyeOff toggle, validação min 6 chars
  4. **Aparência** — 3 botões tema (Escuro/Moon, Claro/Sun, Sistema/Monitor) com violet highlight
- Copiar animações containerVariants/itemVariants exatas
- Copiar FieldLabel component
- Copiar skeleton loader (4 cards placeholder)

---

## 4. Usuários

**Arquivo:** `src/app/(protected)/users/_components/users-content.tsx`

### Estado atual
- 199 linhas, já funcional com CRUD
- Verificar se tem todas as features do Roteador

### Correções necessárias (alinhar com Roteador)
- Verificar coluna "Empresas" (contagem de memberships)
- Verificar coluna "Criado em" com date-fns format PT-BR
- Verificar BadgeSelect inline para role (CustomSelect com ícones + descrições)
- Verificar Switch de status inline
- Verificar ícone de lixeira + confirmação AlertDialog
- Verificar PasswordInput com toggle de visibilidade no create/edit dialog
- Verificar permissões (super_admin não pode ser excluído, current user não edita próprio role)

---

## 5. Empresas

**Arquivo:** `src/app/(protected)/companies/page.tsx` — **NÃO EXISTE (404)**

### Correções
- Criar `page.tsx` (server component) + `_components/companies-content.tsx`
- Implementar CRUD completo:
  - Header com Building2 icon + "Nova Empresa" button
  - Tabela com colunas: Nome, CNPJ/CPF, Membros (count), Status, Criado em, Ações
  - Create dialog: nome, documento, descrição
  - Edit dialog: mesmos campos
  - Delete dialog com confirmação
  - Status badge (ativo/inativo)
- Server action `getCompanies()` já deve existir em `company.ts`
- Copiar padrão visual exato das tabelas do Roteador (motion, badges, etc.)

---

## 6. Configurações

**Arquivo:** `src/app/(protected)/settings/_components/settings-content.tsx`

### Estado atual
- 158 linhas, 3 seções (Geral, Notificações, Sistema)

### Correções (adaptar domínio para CRM)
- Seção 1 — **Geral**: Nome da plataforma, timezone padrão, moeda padrão, idioma padrão
- Seção 2 — **Notificações**: Platform toggle, Email toggle, threshold de alerta
- Seção 3 — **Sistema**: Modo manutenção (switch), retenção de dados (dias)
- Copiar exatamente o padrão visual do Roteador: FieldLabel, FieldHint, grid layout, CustomSelect para dropdowns, save por seção
- Garantir que saves usam server action real `updateSettings()`

---

## 7. Leads

**Arquivo:** `src/app/(protected)/leads/_components/leads-content.tsx` (115 linhas)

### Correções
- Converter de cards/lista para **tabela** (copiar padrão table do Roteador users)
- Colunas: Nome, Email, Telefone, Status (BadgeSelect inline), Origem, Criado em, Ações (edit/delete)
- Header com Target icon + "Novo Lead" button
- Create/Edit dialog com formulário completo
- Delete dialog com confirmação
- Filtros de status como botões toggle (já tem, manter)
- Status badges com cores por status

---

## 8. Contatos

**Arquivo:** `src/app/(protected)/contacts/_components/contacts-content.tsx` (81 linhas)

### Correções
- Converter para **tabela** (mesmo padrão)
- Colunas: Nome, Email, Telefone, Empresa, Cargo, Criado em, Ações
- Header com Contact icon + "Novo Contato" button
- Create/Edit/Delete dialogs
- Animações de tabela (copiar do Roteador)

---

## 9. Oportunidades

**Arquivo:** `src/app/(protected)/opportunities/_components/opportunities-content.tsx` (120 linhas)

### Correções
- Converter para **tabela** (mesmo padrão)
- Colunas: Título, Contato, Valor (R$ formatado), Stage (BadgeSelect inline), Probabilidade, Criado em, Ações
- Header com TrendingUp icon + "Nova Oportunidade" button
- Create/Edit/Delete dialogs
- Stage badges com cores por estágio
- Filtros de stage como botões toggle (já tem, manter)

---

## 10. Componentes compartilhados

### Já existem e estão corretos:
- `notification-bell.tsx` — funcional, só não está sendo usado no dashboard
- `command-palette.tsx` — funcional com ⌘K
- `search-context.tsx` — funcional
- `custom-select.tsx` — funcional

### A verificar/criar:
- `stats-cards.tsx` — criar para dashboard CRM (copiar estrutura do Roteador)
- `dashboard-filters.tsx` — criar (copiar do Roteador, remover company selector)
- `recent-activity.tsx` — criar para dashboard CRM
- `crm-chart.tsx` — criar (adaptar webhook-chart.tsx para dados CRM)

---

## Padrões visuais obrigatórios (copiar 1:1)

1. **Animações:** containerVariants + itemVariants com stagger 0.08
2. **Ícones:** Sempre Lucide, NUNCA emoji
3. **Cards:** `border-border bg-card/50` com rounded-xl
4. **Tabelas:** shadcn Table com hover states
5. **Badges:** Color-coded por status/role
6. **Botões primários:** `bg-violet-600 hover:bg-violet-700`
7. **Loading:** Skeleton com `animate-pulse`
8. **Toast:** Sonner para feedback
9. **Dialogs:** shadcn Dialog para create/edit, AlertDialog para delete
10. **Inputs:** `bg-muted/50 border-border text-foreground`

---

## Ordem de implementação sugerida

1. Sidebar (fix logo + user info) — rápido, impacto global
2. Dashboard (rewrite completo) — página principal
3. Perfil (refactor server/client + 4 cards)
4. Empresas (criar do zero)
5. Leads (converter para tabela + CRUD)
6. Contatos (converter para tabela + CRUD)
7. Oportunidades (converter para tabela + CRUD)
8. Usuários (verificar e alinhar)
9. Configurações (adaptar domínio)
