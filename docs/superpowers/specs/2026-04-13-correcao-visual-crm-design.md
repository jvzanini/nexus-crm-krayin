# Correção Visual CRM — Spec

**Data:** 2026-04-13
**Referência canônica:** `/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/`

## Objetivo

Reescrever todas as telas do CRM para seguir **1:1** o padrão visual do Roteador Webhook, adaptando apenas o domínio (webhooks → CRM). Nenhum layout deve ser inventado — tudo copiado da referência.

---

## 0. Pré-requisitos — Server Actions e Assets faltantes

### Logo
- **`public/logo.png` NÃO EXISTE** — a pasta public está vazia
- Copiar `logo-nexus-ai.png` do Roteador e renomear, ou usar o logo gradient atual como fallback temporário

### Server Actions CRUD (NÃO EXISTEM — precisam ser criadas)
Nenhuma das actions CRUD para as entidades CRM existe:
- `src/lib/actions/leads.ts` — criar: `getLeads()`, `createLead()`, `updateLead()`, `deleteLead()`
- `src/lib/actions/contacts.ts` — criar: `getContacts()`, `createContact()`, `updateContact()`, `deleteContact()`
- `src/lib/actions/opportunities.ts` — criar: `getOpportunities()`, `createOpportunity()`, `updateOpportunity()`, `deleteOpportunity()`
- `src/lib/actions/company.ts` — **falta `deleteCompany()`** (já tem get/create/update)

### Profile Actions — Assinaturas divergem do Roteador
- `updateProfile({ name })` — aceita objeto, NÃO aceita avatarUrl. Existe `updateAvatar(avatarUrl)` separado
- `requestEmailChange(newEmail)` — 1 param (sem senha de confirmação). Roteador usa `(newEmail, password)`
- `changePassword({ currentPassword, newPassword, confirmPassword })` — aceita objeto. Roteador usa `(currentPassword, newPassword)`
- **`getProfile()` NÃO EXISTE** — page atual usa `useSession()` direto
- **Decisão:** Adaptar o profile-content.tsx para usar as assinaturas existentes (chamar `updateProfile({ name })` + `updateAvatar(avatarUrl)` separados), em vez de reescrever as actions

### Settings Actions
- Tem `getAllSettings()` e `setSetting(key, value)` — NÃO tem `updateSettings()`
- Usar `setSetting()` para cada campo individualmente

### Users Actions
- `UserItem` type NÃO é exportado — `getUsers()` retorna `ActionResult` genérico
- Falta `highestRole` field — Roteador usa, CRM não tem
- Precisa adicionar tipo exportado e campos faltantes

---

## 1. Dashboard

**Arquivo:** `src/components/dashboard/dashboard-content.tsx`

### Problemas atuais
- Usa emoji 👋 no greeting
- Dados estáticos/mock (STATS hardcoded, MOCK_CHART)
- Sem `NotificationBell` no canto superior direito
- Sem filtros de período (Hoje / 7 dias / 30 dias)
- Sem tabela de atividades recentes
- Sem polling/realtime
- Sem skeleton loading no primeiro carregamento

### Correções (copiar do Roteador)
- Remover emoji 👋 — greeting fica "Olá, {firstName}" sem emoji
- Adicionar `NotificationBell` ao lado do greeting (flex justify-between)
- Criar `DashboardFilters` com seletor de período (Hoje/7d/30d) + botão refresh (sem company selector — CRM não tem multi-tenant no dashboard)
- Criar `StatsCards` com dados reais via server action `getDashboardData()`
  - 4 cards: Leads, Contatos, Oportunidades Abertas, Taxa de Conversão
  - Cada card com ícone em colored box (sem emoji), valor, delta percentual comparativo
- Criar chart com Recharts (leads/oportunidades ao longo do tempo)
  - **Performance:** usar query agregada por data com groupBy em vez de N+1 queries em loop
- Criar `RecentActivity` (tabela paginada com últimas ações: lead criado, contato adicionado, oportunidade movida)
  - Paginação total deve contar as 3 entidades (lead+contact+opportunity), não só leads
- Implementar polling 60s (copiar padrão do Roteador)
- Skeleton loading no primeiro carregamento (copiar exato)
- Container/item variants com stagger animation (copiar exato)
- Data formatada em PT-BR (copiar lógica manual de weekday/month do Roteador)

### Server Action necessária
- Reescrever `getDashboardData(period, page)` retornando: stats com comparison, chart data agregada, recent activity paginada

---

## 2. Sidebar

**Arquivo:** `src/components/layout/sidebar.tsx`

### Problemas atuais
- Logo usa div com gradiente + `APP_CONFIG.shortName` em vez de imagem
- Mostra badge de role ao lado do logo (não existe no Roteador)
- Mostra email no user info bottom (Roteador mostra role label)

### Correções
- Logo: usar `<Image src="/logo.png">` com shadow roxo (copiar exato do Roteador) — **ATENÇÃO:** `public/logo.png` não existe ainda, precisa ser criado/copiado primeiro
- Subtítulo: "CRM" como `<p>` em vez de badge de role
- User info bottom: mostrar `user.role` (label do nível) em vez de `user.email`
- Remover variável `roleStyle` e import `PLATFORM_ROLE_STYLES` (ficam sem uso após remover badge do logo)
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
  2. **E-mail** — email atual (disabled), novo email, ~~senha atual para confirmação~~ **SEM confirmação de senha** (CRM `requestEmailChange` aceita só `newEmail`), botão + estado de sucesso com checkmark
  3. **Alterar Senha** — senha atual, nova senha, confirmar nova, eye/eyeOff toggle, validação min **8** chars (CRM usa min 8, não 6)
  4. **Aparência** — 3 botões tema (Escuro/Moon, Claro/Sun, Sistema/Monitor) com violet highlight + description text
- **Adaptar chamadas às actions existentes do CRM:**
  - `updateProfile({ name })` + `updateAvatar(avatarUrl)` separados (não fundir em 1 call)
  - `changePassword({ currentPassword, newPassword, confirmPassword })` (passar objeto)
  - `requestEmailChange(newEmail)` (1 param, sem senha)
  - **Criar `getProfile()` action** — query user com name, email, avatarUrl, createdAt
- Copiar animações containerVariants/itemVariants exatas
- Copiar FieldLabel component
- Copiar skeleton loader (4 cards placeholder)

---

## 4. Usuários

**Arquivo:** `src/app/(protected)/users/_components/users-content.tsx`

### Estado atual
- 199 linhas, já funcional com CRUD
- Verificar se tem todas as features do Roteador

### Divergências identificadas (CRM vs Roteador)
O CRM tem 199 linhas, Roteador tem 932 linhas — **gap massivo**. Falta:
- **BadgeSelect component inline** (o CRM usa CustomSelect, Roteador tem BadgeSelect customizado com dropdown fixed position)
- **Create/Edit dialogs completos** (Dialog + formulário com PasswordInput)
- **Delete AlertDialog** com AlertTriangle + confirmação
- **TableSkeleton** loading state
- **Empty state** com ícone
- **`UserItem` type exportado** — CRM usa `any[]`, precisa tipar
- **`highestRole` field** — Roteador usa para badge display, CRM não tem
- **Coluna "Empresas"** com `companiesCount`
- **Coluna "Criado em"** com date-fns PT-BR
- **Permissões `canEdit`/`canDelete`** calculadas no backend
- **motion.tr com row stagger** por item

### Solução
Reescrever inteiramente copiando do Roteador, adaptando:
- descriptions do role para domínio CRM ("Gerencia rotas e webhooks" → "Gerencia leads e contatos")
- Server actions já existem: `getUsers`, `createUser`, `updateUser`, `deleteUser`, `toggleUserRole`

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
- Server actions existentes: `getCompanies()`, `createCompany({ name, logoUrl })`, `updateCompany(id, { name, logoUrl, isActive })`
- **FALTA `deleteCompany()`** — precisa criar
- **`createCompany` aceita `{ name, logoUrl }`, NÃO `{ name, document, description }`** — adaptar formulário ao que a action suporta, ou estender a action
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
- Saves usam `setSetting(key, value)` existente (não existe `updateSettings()` — é key-value individual)

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

1. **Pré-requisitos** — criar logo, server actions CRUD (leads/contacts/opportunities), deleteCompany, getProfile, exportar UserItem type
2. Sidebar (fix logo + user info) — rápido, impacto global
3. Dashboard (rewrite completo) — página principal
4. Perfil (refactor server/client + 4 cards)
5. Usuários (rewrite completo — gap de 199→932 linhas)
6. Empresas (criar do zero)
7. Leads (converter para tabela + CRUD)
8. Contatos (converter para tabela + CRUD)
9. Oportunidades (converter para tabela + CRUD)
10. Configurações (funcionalizar com setSetting)
