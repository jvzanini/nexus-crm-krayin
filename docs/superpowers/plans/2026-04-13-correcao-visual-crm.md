# Correção Visual CRM — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever todas as telas do CRM para seguir 1:1 o padrão visual do Roteador Webhook, eliminando divergências visuais e funcionais.

**Architecture:** Copiar componentes e páginas do Roteador Webhook (`/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/`), adaptando apenas o domínio CRM (webhooks → leads/contatos/oportunidades). Manter estrutura server component (page.tsx) + client component (_components/content.tsx).

**Tech Stack:** Next.js 16, TypeScript, Prisma v7, Tailwind CSS 4, Framer Motion, Lucide React, Recharts, Sonner, shadcn/ui (base-ui)

**Referência canônica:** Sempre ler o arquivo correspondente no Roteador antes de implementar.

---

### Task 0: Pré-requisitos — Server Actions e Assets faltantes

**Files:**
- Create: `src/lib/actions/leads.ts`
- Create: `src/lib/actions/contacts.ts`
- Create: `src/lib/actions/opportunities.ts`
- Modify: `src/lib/actions/company.ts` (adicionar deleteCompany)
- Modify: `src/lib/actions/profile.ts` (adicionar getProfile)
- Modify: `src/lib/actions/users.ts` (exportar UserItem type, adicionar highestRole/companiesCount/canEdit/canDelete)
- Create: `public/logo.png`

- [ ] **Step 1: Copiar logo do Roteador**

```bash
cp "/Users/joaovitorzanini/Developer/Claude Code/Roteador Webhook Meta/public/logo-nexus-ai.png" "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin/public/logo.png"
```

- [ ] **Step 2: Criar CRUD actions para Leads**

Criar `src/lib/actions/leads.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LeadItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  createdAt: Date;
}

export async function getLeads(): Promise<{ success: boolean; data?: LeadItem[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, phone: true, company: true, source: true, status: true, createdAt: true },
  });

  return { success: true, data: leads };
}

export async function createLead(data: {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  if (!data.name.trim()) return { success: false, error: "Nome é obrigatório" };

  await prisma.lead.create({
    data: {
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      company: data.company?.trim() || null,
      source: data.source?.trim() || null,
      status: data.status || "new",
    },
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function updateLead(id: string, data: {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      ...(data.company !== undefined ? { company: data.company.trim() || null } : {}),
      ...(data.source !== undefined ? { source: data.source.trim() || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function deleteLead(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  return { success: true };
}
```

- [ ] **Step 3: Criar CRUD actions para Contacts**

Criar `src/lib/actions/contacts.ts` — mesmo padrão do leads, adaptando campos:
- `getContacts()` → select: id, firstName, lastName, email, phone, organization, title, createdAt
- `createContact({ firstName, lastName, email, phone, organization, title })`
- `updateContact(id, { ... })`
- `deleteContact(id)`

Exportar `ContactItem` interface.

- [ ] **Step 4: Criar CRUD actions para Opportunities**

Criar `src/lib/actions/opportunities.ts` — mesmo padrão, campos:
- `getOpportunities()` → select: id, title, value, stage, probability, createdAt + include contact (firstName, lastName)
- `createOpportunity({ title, contactId, value, stage, probability })`
- `updateOpportunity(id, { ... })`
- `deleteOpportunity(id)`

Exportar `OpportunityItem` interface.

- [ ] **Step 5: Adicionar deleteCompany em company.ts**

Adicionar ao final de `src/lib/actions/company.ts`:

```ts
export async function deleteCompany(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  // Remover memberships antes de deletar
  await prisma.userCompanyMembership.deleteMany({ where: { companyId: id } });
  await prisma.company.delete({ where: { id } });

  return { success: true };
}
```

- [ ] **Step 6: Adicionar getProfile em profile.ts**

Adicionar ao final de `src/lib/actions/profile.ts`:

```ts
export async function getProfile(): Promise<ActionResult<{
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Não autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { name: true, email: true, avatarUrl: true, createdAt: true },
  });

  if (!user) return { success: false, error: "Usuário não encontrado" };

  return {
    success: true,
    data: {
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  };
}
```

- [ ] **Step 7: Atualizar getUsers para retornar UserItem tipado com campos completos**

Em `src/lib/actions/users.ts`:
- Exportar interface `UserItem` com: id, name, email, platformRole, highestRole, isActive, companiesCount, createdAt, canEdit, canDelete, avatarUrl
- `getUsers()` deve incluir `_count: { select: { memberships: true } }` e computar highestRole (label), companiesCount, canEdit, canDelete baseados no caller

Ler o Roteador `src/lib/actions/users.ts` como referência para a lógica de permissão.

- [ ] **Step 8: Commit**

```bash
git add public/logo.png src/lib/actions/leads.ts src/lib/actions/contacts.ts src/lib/actions/opportunities.ts src/lib/actions/company.ts src/lib/actions/profile.ts src/lib/actions/users.ts
git commit -m "feat: criar server actions CRUD para leads, contatos e oportunidades + fixes em company/profile/users"
```

---

### Task 1: Sidebar — Corrigir logo e user info

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Substituir logo gradient por imagem**

Substituir o bloco do logo (linhas 67-83, incluindo role badge) por:

```tsx
<div className="flex items-center gap-3 px-6 py-6">
  <Image src="/logo.png" alt="Nexus AI" width={40} height={40} className="rounded-[22%] shadow-[0_0_12px_rgba(124,58,237,0.3)]" />
  <div>
    <h1 className="text-base font-bold text-foreground tracking-tight">Nexus AI</h1>
    <p className="text-[11px] text-muted-foreground leading-none">CRM</p>
  </div>
</div>
```

Adicionar import: `import Image from "next/image";`

Remover imports não-usados: `APP_CONFIG` de `@/lib/app.config`, `PLATFORM_ROLE_STYLES` de `@/lib/constants/roles`.

Remover variável `roleStyle` (linha 57): `const roleStyle = PLATFORM_ROLE_STYLES[user.platformRole];`

- [ ] **Step 2: Alterar user info bottom — mostrar role em vez de email**

Substituir `{user.email}` por `{user.role}` na linha 160 (dentro do `<p className="text-[11px] text-muted-foreground truncate">`).

- [ ] **Step 3: Build e commit**

Run: `cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && npx next build 2>&1 | tail -5`
Expected: Build sem erros

```bash
git add src/components/layout/sidebar.tsx
git commit -m "fix(sidebar): usar logo imagem e mostrar role no user info"
```

---

### Task 2: Dashboard — Rewrite completo com dados reais

**Files:**
- Modify: `src/lib/actions/dashboard.ts`
- Create: `src/components/dashboard/stats-cards.tsx`
- Create: `src/components/dashboard/dashboard-filters.tsx`
- Create: `src/components/dashboard/recent-activity.tsx`
- Modify: `src/components/dashboard/dashboard-content.tsx`

- [ ] **Step 1: Reescrever server action getDashboardData**

Substituir todo o conteúdo de `src/lib/actions/dashboard.ts`. Pontos críticos:
- Import: `subDays`, `startOfDay`, `format` de date-fns (NÃO importar `startOfMonth` — não usado)
- Queries de chart devem ser **agregadas por data** (evitar N+1 loop de 30 queries)
- `totalActivityCount` deve contar **leads + contacts + opportunities**, não só leads
- Remover query duplicada de `totalLeads` (é igual a `currentLeads`)

Ler referência: Roteador `src/lib/actions/dashboard.ts` + adaptação CRM da spec.

- [ ] **Step 2: Criar StatsCards**

Criar `src/components/dashboard/stats-cards.tsx` — copiar visual 1:1 do Roteador (`src/components/dashboard/stats-cards.tsx`), adaptando:
- Labels: "Leads", "Contatos", "Oportunidades Abertas", "Taxa de Conversão"
- Icons: Target, Users, TrendingUp, Percent
- Type import: `DashboardStats` de `@/lib/actions/dashboard`

- [ ] **Step 3: Criar DashboardFilters**

Criar `src/components/dashboard/dashboard-filters.tsx` — copiar do Roteador, **remover company selector** (CRM não tem filtro por empresa no dashboard). Manter: período toggle (Hoje/7d/30d) + botão refresh.

- [ ] **Step 4: Criar RecentActivity**

Criar `src/components/dashboard/recent-activity.tsx` — copiar padrão do Roteador `recent-deliveries.tsx`, adaptando:
- Colunas: Quando, Tipo (lead/contact/opportunity com ícone), Ação, Nome, Status
- Type import: `RecentActivityItem` de `@/lib/actions/dashboard`
- Paginação com Previous/Next

- [ ] **Step 5: Reescrever DashboardContent**

Substituir todo `src/components/dashboard/dashboard-content.tsx`. Pontos críticos:
- **NÃO importar `TrendingUp` duas vezes** — importar uma vez do lucide-react junto com `LayoutDashboard`
- Adicionar `NotificationBell` no greeting (flex justify-between)
- containerVariants/itemVariants com stagger 0.08
- Polling 60s
- Skeleton loading
- Chart com Recharts inline (LineChart leads vs oportunidades)
- Remover todos os dados mock/estáticos

- [ ] **Step 6: Build e commit**

```bash
git add src/lib/actions/dashboard.ts src/components/dashboard/
git commit -m "feat(dashboard): rewrite com dados reais, filtros, stats cards e atividades recentes"
```

---

### Task 3: Perfil — Refactor para server/client + copiar visual do Roteador

**Files:**
- Modify: `src/app/(protected)/profile/page.tsx`
- Create: `src/app/(protected)/profile/_components/profile-content.tsx`
- Modify: `src/lib/actions/profile.ts` (se necessário ajustar assinaturas)

- [ ] **Step 1: Criar profile-content.tsx**

Copiar **estrutura visual** do Roteador `profile-content.tsx`, mas **adaptar todas as chamadas de action** para as assinaturas reais do CRM:

| Roteador chama | CRM tem | Adaptar para |
|---|---|---|
| `getProfile()` | **Criado no Task 0 Step 6** | `getProfile()` ✓ |
| `updateProfile(name, avatarUrl)` | `updateProfile({ name })` + `updateAvatar(avatarUrl)` | Chamar as 2 actions separadamente |
| `requestEmailChange(newEmail, password)` | `requestEmailChange(newEmail)` | Remover campo "senha de confirmação" do card de Email |
| `changePassword(currentPassword, newPassword)` | `changePassword({ currentPassword, newPassword, confirmPassword })` | Passar objeto com 3 campos |

Os 4 cards são:
1. **Informações Pessoais** — avatar upload (resize 128x128 WebP), nome, "Membro desde", save (chama `updateProfile({ name })` + `updateAvatar(avatarUrl)`)
2. **E-mail** — email atual (disabled), novo email, botão alterar (SEM campo senha — CRM não exige), estado de sucesso com checkmark
3. **Alterar Senha** — senha atual, nova senha, confirmar nova, eye/eyeOff toggle, validação min **8** chars
4. **Aparência** — 3 botões tema com description

- [ ] **Step 2: Converter page.tsx para server component**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileContent } from "./_components/profile-content";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ProfileContent />;
}
```

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/profile/
git commit -m "refactor(perfil): separar server/client e copiar visual 1:1 do Roteador"
```

---

### Task 4: Usuários — Rewrite completo copiando do Roteador

**Files:**
- Modify: `src/app/(protected)/users/_components/users-content.tsx`

**Contexto:** CRM tem 199 linhas, Roteador tem 932 linhas — gap massivo. Precisa rewrite completo, não "verificar".

- [ ] **Step 1: Reescrever users-content.tsx copiando do Roteador**

Copiar **inteiro** do Roteador `src/app/(protected)/users/users-content.tsx`, adaptando:
- Props: `UsersContentProps { isSuperAdmin: boolean; currentUserId: string }` (mesmo padrão)
- Descriptions do role: "Gerencia rotas e webhooks" → "Gerencia leads e contatos"
- Import `UserItem` do `@/lib/actions/users` (criado no Task 0)
- Import server actions: `getUsers`, `createUser`, `updateUser`, `deleteUser` (já existem)

Componentes incluídos no arquivo (copiar todos):
- `BadgeSelect` — dropdown inline com fixed positioning
- `PasswordInput` — input com toggle eye/eyeOff
- `TableSkeleton` — loading state
- `renderForm()` — formulário compartilhado create/edit
- `getRoleBadge()` — color mapping por role

- [ ] **Step 2: Verificar que page.tsx passa as props corretas**

`page.tsx` deve passar `isSuperAdmin` e `currentUserId` — verificar se já faz isso ou se passa `currentUser` como objeto.

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/users/
git commit -m "feat(usuários): rewrite completo com BadgeSelect, CRUD e permissões"
```

---

### Task 5: Empresas — Criar página CRUD do zero

**Files:**
- Create: `src/app/(protected)/companies/page.tsx`
- Create: `src/app/(protected)/companies/_components/companies-content.tsx`

- [ ] **Step 1: Criar page.tsx server component**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CompaniesContent } from "./_components/companies-content";

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CompaniesContent currentUser={user} />;
}
```

- [ ] **Step 2: Criar companies-content.tsx**

Seguir padrão exato do Roteador users-content.tsx, adaptando para empresas:
- Header com Building2 icon + "Nova Empresa" button
- Table: Nome, Membros (count), Status (switch), Criado em, Ações
- Create dialog: nome (campo obrigatório). **NÃO** incluir campo documento/CNPJ — `createCompany` aceita `{ name, logoUrl }`
- Edit dialog: nome, status
- Delete AlertDialog (usa `deleteCompany` criada no Task 0)
- Motion animations + skeleton + empty state

Server actions: `getCompanies`, `createCompany`, `updateCompany`, `deleteCompany` de `@/lib/actions/company.ts`.

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/companies/
git commit -m "feat(empresas): criar página CRUD com visual padrão Roteador"
```

---

### Task 6: Leads — Converter para tabela com CRUD

**Files:**
- Modify: `src/app/(protected)/leads/_components/leads-content.tsx`
- Modify: `src/app/(protected)/leads/page.tsx`

- [ ] **Step 1: Reescrever leads-content.tsx com tabela + CRUD**

Converter de lista simples para tabela completa seguindo padrão Roteador:
- Table: Nome, Email, Telefone, Status (Badge colorido), Empresa, Criado em, Ações (edit/delete)
- Header com Target icon + "Novo Lead" button (bg-violet-600)
- Create dialog: nome, email, telefone, empresa, fonte
- Edit dialog: mesmos campos + status select
- Delete AlertDialog
- Filtros de status como botões toggle (manter padrão existente)
- Motion animations + skeleton + empty state

Server actions: `getLeads`, `createLead`, `updateLead`, `deleteLead` de `@/lib/actions/leads.ts` (criadas no Task 0).

- [ ] **Step 2: Atualizar page.tsx — usar server action em vez de Prisma direto**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LeadsContent } from "./_components/leads-content";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <LeadsContent />;
}
```

O componente carrega dados via `getLeads()` no useEffect (client-side), não recebe como prop.

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/leads/
git commit -m "feat(leads): converter para tabela CRUD com visual padrão Roteador"
```

---

### Task 7: Contatos — Converter para tabela com CRUD

**Files:**
- Modify: `src/app/(protected)/contacts/_components/contacts-content.tsx`
- Modify: `src/app/(protected)/contacts/page.tsx`

- [ ] **Step 1: Reescrever contacts-content.tsx com tabela + CRUD**

Mesmo padrão do Task 6:
- Table: Nome Completo, Email, Telefone, Empresa, Cargo, Criado em, Ações
- Header com Users icon (emerald) + "Novo Contato" button
- Create/Edit/Delete dialogs
- Motion animations + skeleton + empty state

Server actions: `getContacts`, `createContact`, `updateContact`, `deleteContact` de `@/lib/actions/contacts.ts`.

- [ ] **Step 2: Atualizar page.tsx (mesmo padrão do leads)**

- [ ] **Step 3: Build e commit**

```bash
git add src/app/(protected)/contacts/
git commit -m "feat(contatos): converter para tabela CRUD com visual padrão Roteador"
```

---

### Task 8: Oportunidades — Converter para tabela com CRUD

**Files:**
- Modify: `src/app/(protected)/opportunities/_components/opportunities-content.tsx`
- Modify: `src/app/(protected)/opportunities/page.tsx`

- [ ] **Step 1: Reescrever opportunities-content.tsx com tabela + CRUD**

Mesmo padrão:
- Table: Título, Contato, Valor (R$ formatado com `toLocaleString("pt-BR")`), Stage (Badge colorido), Criado em, Ações
- Header com TrendingUp icon + "Nova Oportunidade" button
- Create dialog: título, contactId (select de contatos), valor, stage, probabilidade
- Edit/Delete dialogs
- Stage badges coloridos por estágio
- Filtros de stage (manter toggle existente)

Server actions: `getOpportunities`, `createOpportunity`, `updateOpportunity`, `deleteOpportunity` de `@/lib/actions/opportunities.ts`.

- [ ] **Step 2: Build e commit**

```bash
git add src/app/(protected)/opportunities/
git commit -m "feat(oportunidades): converter para tabela CRUD com visual padrão Roteador"
```

---

### Task 9: Configurações — Funcionalizar com server actions

**Files:**
- Modify: `src/app/(protected)/settings/_components/settings-content.tsx`

- [ ] **Step 1: Reescrever com dados reais**

Copiar padrão visual do Roteador settings-content.tsx, adaptando:
- Seção Geral: Nome plataforma, email suporte
- Seção Notificações: Toggle email, toggle plataforma
- Seção Sistema: Toggle modo manutenção
- Carregar valores via `getAllSettings()` no mount
- **Saves usam `setSetting(key, value)` por campo** (não existe `updateSettings()`)
- FieldLabel/FieldHint components
- containerVariants/itemVariants com stagger

- [ ] **Step 2: Build e commit**

```bash
git add src/app/(protected)/settings/
git commit -m "fix(configurações): funcionalizar saves com setSetting()"
```

---

### Task 10: Verificação final

- [ ] **Step 1: Full build**

Run: `cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && npx next build`
Expected: Build completo sem erros

- [ ] **Step 2: Verificar todas as rotas no dev server**

Run: `npx next dev`

Checar visualmente:
- `/dashboard` — greeting sem emoji, NotificationBell, filtros período, stats cards com dados reais, gráfico Recharts, atividades recentes com paginação
- `/profile` — 4 cards separados (info pessoais com avatar upload, email sem campo senha, alterar senha com eye toggle, aparência com 3 temas + description)
- `/companies` — CRUD funcional com tabela, create/edit/delete
- `/leads` — tabela CRUD com filtros de status
- `/contacts` — tabela CRUD
- `/opportunities` — tabela CRUD com valor R$ formatado e stage badges
- `/users` — BadgeSelect inline para role e status, create/edit/delete dialogs, todas as colunas
- `/settings` — saves funcionais com dados persistidos
- Sidebar — logo imagem, "CRM" subtítulo, role no user info bottom

- [ ] **Step 3: Commit final se houver ajustes**

```bash
git add -A
git commit -m "fix: ajustes finais de verificação visual"
```
