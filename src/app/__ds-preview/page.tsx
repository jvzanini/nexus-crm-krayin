export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Home,
  Inbox,
  Package,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";

import { DS_PREVIEW } from "@/lib/flags";

import {
  AppShell,
  Avatar,
  Breadcrumb,
  Button,
  DropdownMenu,
  EmptyState,
  ErrorState,
  IconTile,
  LoadingSpinner,
  PageHeader,
  ScrollArea,
  Separator,
  Skeleton,
  Tabs,
  Tooltip,
  TooltipProvider,
} from "@nexusai360/design-system";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold border-b border-border pb-2">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

export default function DsPreviewPage() {
  if (!DS_PREVIEW) notFound();

  return (
    <TooltipProvider>
      <div className="p-8 space-y-12 max-w-5xl mx-auto">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">DS Preview v0.3.0</h1>
          <p className="text-muted-foreground">
            Smoke visual dos 14 novos componentes do @nexusai360/design-system.
          </p>
        </header>

        <Section title="1. Skeleton">
          <Row>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-24 w-48 rounded-xl" />
          </Row>
        </Section>

        <Section title="2. LoadingSpinner">
          <Row>
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" label="Carregando…" />
          </Row>
        </Section>

        <Section title="3. Separator">
          <div className="space-y-4">
            <div>Acima horizontal</div>
            <Separator />
            <div>Abaixo horizontal</div>
            <div className="flex items-center gap-4 h-10">
              <span>A</span>
              <Separator orientation="vertical" />
              <span>B</span>
              <Separator orientation="vertical" />
              <span>C</span>
            </div>
          </div>
        </Section>

        <Section title="4. IconTile">
          <Row>
            <IconTile icon={Users} color="violet" size="sm" />
            <IconTile icon={Users} color="violet" size="md" />
            <IconTile icon={Users} color="violet" size="lg" />
            <IconTile icon={Package} color="blue" size="md" />
            <IconTile icon={Settings} color="emerald" size="md" />
            <IconTile icon={AlertTriangle} color="amber" size="md" />
            <IconTile icon={Inbox} color="red" size="md" />
          </Row>
        </Section>

        <Section title="5. Avatar">
          <Row>
            <Avatar>
              <Avatar.Image
                src="https://i.pravatar.cc/80?img=1"
                alt="User 1"
              />
              <Avatar.Fallback>U1</Avatar.Fallback>
            </Avatar>
            <Avatar>
              <Avatar.Fallback>JV</Avatar.Fallback>
            </Avatar>
            <Avatar>
              <Avatar.Fallback>AB</Avatar.Fallback>
            </Avatar>
            <Avatar>
              <Avatar.Image src="/broken.png" alt="broken" />
              <Avatar.Fallback>XX</Avatar.Fallback>
            </Avatar>
          </Row>
        </Section>

        <Section title="6. Tooltip">
          <Row>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={<Button>Hover me</Button>}
              />
              <Tooltip.Content>Tooltip simples</Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={<Button variant="outline">Right side</Button>}
              />
              <Tooltip.Content side="right">Outra tooltip</Tooltip.Content>
            </Tooltip.Root>
          </Row>
        </Section>

        <Section title="7. Tabs">
          <Tabs.Root defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Visão geral</Tabs.Tab>
              <Tabs.Tab value="activity">Atividade</Tabs.Tab>
              <Tabs.Tab value="settings">Configurações</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview" className="pt-4">
              Conteúdo da visão geral.
            </Tabs.Panel>
            <Tabs.Panel value="activity" className="pt-4">
              Conteúdo da atividade.
            </Tabs.Panel>
            <Tabs.Panel value="settings" className="pt-4">
              Conteúdo de configurações.
            </Tabs.Panel>
          </Tabs.Root>
        </Section>

        <Section title="8. DropdownMenu">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger render={<Button>Abrir menu</Button>} />
            <DropdownMenu.Content>
              <DropdownMenu.Item>Perfil</DropdownMenu.Item>
              <DropdownMenu.Item>Configurações</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item variant="destructive">Sair</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Section>

        <Section title="9. ScrollArea">
          <ScrollArea className="h-48 w-full border border-border rounded-md p-4">
            <div className="space-y-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="text-sm">
                  Linha {i + 1} — exemplo de conteúdo rolável dentro de ScrollArea.
                </div>
              ))}
            </div>
          </ScrollArea>
        </Section>

        <Section title="10. EmptyState">
          <EmptyState.Root>
            <EmptyState.Icon icon={Inbox} />
            <EmptyState.Title>Nenhum item ainda</EmptyState.Title>
            <EmptyState.Description>
              Crie seu primeiro item para começar.
            </EmptyState.Description>
            <EmptyState.Action>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar item
              </Button>
            </EmptyState.Action>
          </EmptyState.Root>
        </Section>

        <Section title="11. ErrorState">
          <ErrorState.Root>
            <ErrorState.Icon icon={AlertTriangle} />
            <ErrorState.Title>Falha ao carregar</ErrorState.Title>
            <ErrorState.Description>
              Não foi possível carregar os dados.
            </ErrorState.Description>
            <ErrorState.Details>
              Error: network timeout after 30000ms
            </ErrorState.Details>
            <ErrorState.Action>
              <Button variant="outline">Tentar novamente</Button>
            </ErrorState.Action>
          </ErrorState.Root>
        </Section>

        <Section title="12. Breadcrumb">
          <Breadcrumb.Root>
            <Breadcrumb.Item href="/">
              <Home className="inline h-3.5 w-3.5 mr-1" />
              Home
            </Breadcrumb.Item>
            <Breadcrumb.Separator>
              <ChevronRight className="h-3.5 w-3.5" />
            </Breadcrumb.Separator>
            <Breadcrumb.Item href="/settings">Settings</Breadcrumb.Item>
            <Breadcrumb.Separator>
              <ChevronRight className="h-3.5 w-3.5" />
            </Breadcrumb.Separator>
            <Breadcrumb.Item current>Profile</Breadcrumb.Item>
          </Breadcrumb.Root>
        </Section>

        <Section title="13. PageHeader">
          <PageHeader.Root>
            <PageHeader.Row>
              <div className="flex items-start gap-4">
                <PageHeader.Icon icon={Users} color="violet" />
                <PageHeader.Heading>
                  <PageHeader.Title>Usuários</PageHeader.Title>
                  <PageHeader.Description>
                    Gerencie os membros da sua empresa.
                  </PageHeader.Description>
                </PageHeader.Heading>
              </div>
              <PageHeader.Actions>
                <Button variant="outline">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              </PageHeader.Actions>
            </PageHeader.Row>
          </PageHeader.Root>
        </Section>

        <Section title="14. AppShell">
          <div className="border border-border rounded-md overflow-hidden h-64">
            <AppShell.Root className="min-h-0 h-full grid-cols-[200px_1fr]">
              <AppShell.Sidebar className="block p-4 space-y-2 text-sm">
                <div className="font-semibold">Nav</div>
                <div>Item 1</div>
                <div>Item 2</div>
                <div>Item 3</div>
              </AppShell.Sidebar>
              <AppShell.Content>
                <AppShell.Header className="px-4">
                  Header do AppShell
                </AppShell.Header>
                <AppShell.Main className="p-4">
                  Conteúdo principal do AppShell.
                </AppShell.Main>
              </AppShell.Content>
            </AppShell.Root>
          </div>
        </Section>
      </div>
    </TooltipProvider>
  );
}
