# Auditoria do Nexus Blueprint — Spec

**Data:** 2026-04-13
**Objetivo:** Identificar e corrigir as falhas no Blueprint (skill `criar` + docs) que causaram divergências visuais/funcionais no CRM, para que a próxima plataforma já saia correta.

---

## Metodologia

Cruzamos cada correção feita no CRM (16 commits, 11 tasks) com o que a skill `criar` (SKILL.md, 676 linhas) e os docs do Blueprint direcionam. Para cada divergência, classificamos a causa raiz e a correção necessária no Blueprint.

---

## Divergências encontradas e causa raiz

### 1. Dashboard — Emoji 👋 no greeting

**O que aconteceu:** CRM entregou `"Olá, {nome} 👋"` com emoji.

**O que o Blueprint diz:** SKILL.md linha 509: "Ícones SEMPRE lucide (NUNCA emojis)". Linha 549: `header "Olá, {userName}" + data formatada`. Linha 558: "NÃO adicione emoji como ícone".

**Causa raiz:** A regra existe mas é genérica ("ícones NUNCA emojis"). O subagent interpretou o 👋 como decoração de texto, não como ícone. Falta uma proibição explícita de emojis em QUALQUER texto de UI.

**Correção no Blueprint:**
- SKILL.md: Adicionar na seção "NÃO FAÇA": `"NÃO use emojis em nenhum lugar — nem como ícone, nem como decoração de texto, nem em greetings. Zero emojis em toda a plataforma."`

---

### 2. Dashboard — Dados mock/estáticos em vez de dados reais

**O que aconteceu:** CRM entregou `MOCK_CHART` e `STATS` hardcoded com valores fixos.

**O que o Blueprint diz:** `patterns/dashboard.md` linhas 44-86 descreve arquitetura com Server Action `getDashboardData` + Prisma queries. Mas a skill `criar` (linha 499) apenas diz: "4 stats cards (grid responsivo) + LineChart Recharts" — não exige explicitamente que os dados sejam reais.

**Causa raiz:** A skill descreve componentes visuais mas não exige que o subagent implemente a server action com dados reais. O `patterns/dashboard.md` tem a arquitetura correta mas o subagent de Pages não lê esse doc — quem lê é o subagent de Actions.

**Correção no Blueprint:**
- SKILL.md linha 499: Expandir para: `"dashboard/ — Server component que passa userName. DashboardContent client component com: getDashboardData() server action com dados REAIS do Prisma (NUNCA mock/hardcoded), 4 stats cards com comparison vs período anterior, filtros de período (Hoje/7d/30d) à DIREITA com título 'Dashboard' à ESQUERDA, LineChart Recharts, tabela de atividades recentes paginada, NotificationBell no greeting, polling 60s, skeleton loading."`

---

### 3. Dashboard — Layout dos filtros errado (esquerda vs direita)

**O que aconteceu:** Filtros ficaram à esquerda sem título "Dashboard". Roteador tem título à esquerda e filtros à direita.

**O que o Blueprint diz:** Linha 549: "Filtro de período à direita" — correto mas vago.

**Causa raiz:** Falta código de referência mostrando o layout exato do DashboardFilters com título + filtros.

**Correção no Blueprint:**
- `patterns/dashboard.md`: Adicionar seção "Layout do filtro" com código:
  ```tsx
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
    <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
    <div className="flex ... sm:ml-auto">
      {/* period toggle + refresh button */}
    </div>
  </div>
  ```

---

### 5. Sidebar — Logo gradient em vez de imagem

**O que aconteceu:** CRM usou div com gradient + texto em vez de `<Image src="/logo.png">`.

**O que o Blueprint diz:** Linha 496 menciona sidebar mas não especifica que o logo deve ser uma imagem. O template `app.config.ts` tem `logo: "/logo.png"` mas isso não é enforçado na sidebar.

**Causa raiz:** A skill `criar` (linha 491) diz "troque o Image por um ícone lucide dentro de box gradient" — essa instrução é para o LOGIN, não para a sidebar. Mas não há instrução explícita de que a sidebar deve usar `<Image src={APP_CONFIG.logo}>`.

**Correção no Blueprint:**
- SKILL.md: Na seção sidebar, adicionar: `"Logo da sidebar: usar <Image src="/logo.png"> com shadow glow (copiar exato da referência). Subtítulo: APP_CONFIG.description ou nome curto da plataforma. NÃO usar div gradient com texto como logo — isso é só pro login."`

---

### 6. Sidebar — Email em vez de role no user info

**O que aconteceu:** Sidebar mostrava email do usuário em vez do role label.

**O que o Blueprint diz:** Linha 496: "Avatar + nome + badge de role visual no topo" — fala do topo, não do bottom.

**Causa raiz:** A referência (Roteador) mostra role no bottom. O Blueprint fala de "badge de role no topo" que é diferente. Instrução ambígua sobre o que mostrar no bottom.

**Correção no Blueprint:**
- SKILL.md: Especificar: `"User info no bottom da sidebar: avatar + nome + role label (NÃO email). O email não aparece na sidebar em lugar nenhum."`

---

### 7. Perfil — Sem separação server/client

**O que aconteceu:** Perfil era 100% client component (282 linhas no page.tsx).

**O que o Blueprint diz:** Linha 500: "profile/ — avatar upload, nome, email (com fluxo verify), senha, toggle de tema" — não especifica arquitetura server/client.

**Causa raiz:** Falta instrução explícita de que TODAS as páginas protegidas devem seguir o padrão server component (page.tsx) + client component (_components/content.tsx).

**Correção no Blueprint:**
- SKILL.md: Adicionar regra geral: `"TODAS as páginas protegidas DEVEM seguir o padrão: page.tsx como server component (auth check + redirect) que renderiza um client component em _components/. Nunca colocar 'use client' no page.tsx de páginas protegidas."`

---

### 8. Usuários — Implementação simplificada (199 vs 932 linhas)

**O que aconteceu:** Tabela de usuários muito simplificada — sem BadgeSelect, sem create/edit/delete dialogs, sem PasswordInput, sem permissões canEdit/canDelete.

**O que o Blueprint diz:** Linha 501: "tabela CRUD com hover, badge de role inline editável (via toggleUserRole action), modal criação/deleção com Framer Motion" — correto mas sem código de referência.

**Causa raiz:** Instrução em texto é insuficiente para uma página complexa de 932 linhas. O subagent precisa copiar da referência, não interpretar uma frase.

**Correção no Blueprint:**
- SKILL.md: Alterar para: `"users/ — COPIAR INTEGRALMENTE de src/app/(protected)/users/users-content.tsx da referência. Inclui: BadgeSelect component inline para role E status, PasswordInput com toggle, TableSkeleton, Create/Edit Dialog, Delete AlertDialog, permissões canEdit/canDelete, motion.tr row stagger. Adaptar apenas textos de domínio. NÃO simplificar."`

---

### 9. Empresas — Página não existia (404)

**O que aconteceu:** Rota /companies retornava 404.

**O que o Blueprint diz:** Não menciona empresas como página obrigatória no core. É parte do módulo multi-tenant mas não há instrução para criar a página.

**Causa raiz:** O módulo `multi-tenant.md` documenta o modelo de dados e as actions, mas não menciona que precisa de uma página de gestão de empresas.

**Correção no Blueprint:**
- `modules/multi-tenant.md`: Adicionar seção "Página obrigatória": `"Criar src/app/(protected)/companies/ com page.tsx + _components/companies-content.tsx. CRUD com tabela, create/edit/delete dialogs, status toggle. Seguir padrão visual exato de users-content.tsx."`

---

### 10. CRUD actions para entidades de domínio inexistentes

**O que aconteceu:** Não existiam getLeads, createLead, etc. As pages faziam query Prisma direto.

**O que o Blueprint diz:** A skill `criar` cria actions para core (users, profile, password-reset) mas não cria actions para entidades de domínio (o que cada plataforma faz de específico).

**Causa raiz:** Gap arquitetural — o Blueprint cria a infraestrutura mas não cria actions CRUD para os modelos de domínio que ele próprio adiciona via Prisma schema.

**Correção no Blueprint:**
- SKILL.md: Adicionar na seção 7.11 subagente Actions: `"Para CADA modelo de domínio adicionado ao schema Prisma (que não seja core), criar um arquivo de actions CRUD em src/lib/actions/{modelo}.ts com: get{Modelo}s(), create{Modelo}(), update{Modelo}(), delete{Modelo}(). Seguir exatamente o padrão de users.ts. Exportar interface {Modelo}Item com tipagem completa."`

---

### 11. Busca ⌘K — Campos title/subtitle vs label/sublabel

**O que aconteceu:** API retornava `{ results: { label, sublabel } }` mas o command-palette lia `title`/`subtitle`.

**O que o Blueprint diz:** Linha 572: `"Retorna JSON { [entityName]: SearchItem[] } onde SearchItem = { id, title, subtitle, href, type, meta? }"` — correto!

**Causa raiz:** O subagent de Search criou a API com campos diferentes do especificado. A skill tem a spec correta mas o subagent não seguiu.

**Correção no Blueprint:**
- SKILL.md: Reforçar na seção Search: `"IMPORTANTE: A API DEVE retornar exatamente { [entityName]: SearchItem[] } como objeto flat (SEM wrapper 'results'). Cada item DEVE ter campos 'title' e 'subtitle' (NÃO 'label'/'sublabel'). O command-palette.tsx lê esses campos exatos."`

---

### 12. Configurações — Saves fake (toast only)

**O que aconteceu:** Botões "Salvar" apenas mostravam toast sem persistir nada.

**O que o Blueprint diz:** `patterns/settings.md` documenta `getAllSettings()` e `updateSettings()` com Prisma. Mas a skill `criar` (linha 502) apenas diz "cards por categoria, edição inline, só super_admin acessa" — não exige saves funcionais.

**Causa raiz:** Instrução vaga. O subagent criou o visual sem a funcionalidade.

**Correção no Blueprint:**
- SKILL.md linha 502: Expandir para: `"settings/ — Carregar valores REAIS via getAllSettings() no mount. Saves FUNCIONAIS usando setSetting(key, value) para cada campo. NUNCA fake saves com toast-only. Cada seção tem save independente com loading state via useTransition."`

---

### 13. Acentos faltando em textos PT-BR

**O que aconteceu:** Múltiplos textos sem acento: "periodo", "Pagina", "Proxima", "Conversao".

**O que o Blueprint diz:** Linha 511: "Textos PT-BR com acentos corretos". Template CLAUDE.md: "Todo texto visível ao usuário DEVE ter acentos e caracteres PT-BR corretos".

**Causa raiz:** A regra existe mas não é propagada para os subagents. Cada subagent deveria receber essa instrução explicitamente no prompt.

**Correção no Blueprint:**
- SKILL.md: Adicionar no prompt de CADA subagent: `"REGRA ABSOLUTA: Todo texto visível ao usuário DEVE ter acentos PT-BR corretos (Olá, não Ola; período, não periodo; Página, não Pagina; Próxima, não Proxima; Conversão, não Conversao; Informações, não Informacoes). Revise todo texto antes de finalizar."`

---

### 14. deleteCompany não existia

**O que aconteceu:** Action company.ts tinha get/create/update mas não delete.

**O que o Blueprint diz:** `modules/multi-tenant.md` documenta CRUD mas a skill não garante que todos os 4 métodos são criados.

**Correção no Blueprint:**
- Coberto pelo item 10 (criar CRUD completo para todos os modelos).

---

### 15. getProfile não existia

**O que aconteceu:** Perfil usava useSession() direto em vez de server action.

**O que o Blueprint diz:** `core/overview.md` seção Profile documenta getProfile mas a skill não garante que é criada.

**Correção no Blueprint:**
- SKILL.md subagente Actions: Listar explicitamente: `"profile.ts: getProfile(), updateProfile(), updateAvatar(), changePassword(), requestEmailChange(), updateTheme()"`

---

### 16. UserItem type não exportado

**O que aconteceu:** getUsers() retornava dados sem tipo exportado, sem highestRole, companiesCount, canEdit, canDelete.

**O que o Blueprint diz:** Linha 501 menciona "badge de role inline editável" mas não especifica que getUsers deve retornar campos computados.

**Correção no Blueprint:**
- SKILL.md subagente Actions: `"users.ts: DEVE exportar interface UserItem com: id, name, email, platformRole, highestRole (label), isActive, companiesCount (_count.memberships), createdAt, canEdit, canDelete, avatarUrl. getUsers() deve computar permissões baseadas no caller."`

---

### 16. Template CLAUDE.md — Sem seção de padrão visual

**O que aconteceu:** O CLAUDE.md gerado não tinha informação sobre o padrão visual canônico (referência ao Roteador), nem regras de ícones, animações ou tabelas.

**O que o Blueprint diz:** `templates/claude-md.template` tem stack, modules e deploy mas nenhuma seção visual.

**Causa raiz:** O template não propaga as regras visuais do `core/ui.md` para o CLAUDE.md do projeto. Sem isso, sessões futuras (sem acesso ao Blueprint) não sabem qual é o padrão.

**Correção no Blueprint:**
- `templates/claude-md.template`: Adicionar seção "Padrão Visual" com:
  - Referência canônica ao Roteador Webhook
  - Regra de ícones (3 padrões, nunca emoji)
  - Padrão de animações (stagger 0.08, itemVariants)
  - Padrão de tabelas CRUD (BadgeSelect, dialogs, motion.tr)
  - Padrão server/client (page.tsx server + _components/ client)

---

## Resumo das correções no Blueprint

### Arquivos a modificar

| Arquivo | Tipo de correção |
|---|---|
| `skills/criar/SKILL.md` | 12 correções (maioria aqui) |
| `patterns/dashboard.md` | 2 correções (layout filtros, requisitos completos) |
| `patterns/settings.md` | 1 correção (exigir saves funcionais) |
| `modules/multi-tenant.md` | 1 correção (página empresas obrigatória) |
| `templates/claude-md.template` | 1 correção (seção padrão visual) |

### Categorias de falha

| Categoria | Qtd | Exemplos |
|---|---|---|
| Instrução vaga/incompleta | 7 | Dashboard sem detalhe, settings sem funcionalidade, users sem código |
| Instrução faltante | 4 | Empresas, CRUD domínio, getProfile, sidebar logo |
| Instrução não propagada | 2 | Acentos PT-BR, campos SearchItem |
| Instrução ambígua | 2 | Sidebar role vs email, emoji como "decoração" |
| Regra correta mas não seguida | 1 | Busca title/subtitle |
