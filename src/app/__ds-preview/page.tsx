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
    <div className="p-8 space-y-12 max-w-5xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">DS Preview v0.3.0</h1>
        <p className="text-muted-foreground">
          Smoke visual dos 14 novos componentes do @nexusai360/design-system.
        </p>
      </header>

      {/* 1. Skeleton */}
      <Section title="1. Skeleton">
        <Row>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-24 w-48 rounded-xl" />
        </Row>
      </Section>

      {/* 2. LoadingSpinner */}
      <Section title="2. LoadingSpinner">
        <Row>
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
          <LoadingSpinner size="lg" />
        </Row>
      </Section>

      {/* 3. Separator */}
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

      {/* 4. IconTile */}
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

      {/* 5. Avatar */}
      <Section title="5. Avatar">
        <Row>
          <Avatar src="https://i.pravatar.cc/80?img=1" alt="User 1" />
          <Avatar fallback="JV" />
          <Avatar fallback="AB" />
          <Avatar src="/broken.png" fallback="XX" alt="broken" />
        </Row>
      </Section>

      {/* 6. Tooltip */}
      <Section title="6. Tooltip">
        <Row>
          <Tooltip content="Tooltip simples">
            <Button>Hover me</Button>
          </Tooltip>
          <Tooltip content="Outra tooltip" side="right">
            <Button variant="outline">Right side</Button>
          </Tooltip>
        </Row>
      </Section>

      {/* 7. Tabs */}
      <Section title="7. Tabs">
        <Tabs
          defaultValue="overview"
          tabs={[
            {
              value: "overview",
              label: "Visão geral",
              content: <div className="pt-4">Conteúdo da visão geral.</div>,
            },
            {
              value: "activity",
              label: "Atividade",
              content: <div className="pt-4">Conteúdo da atividade.</div>,
            },
            {
              value: "settings",
              label: "Configurações",
              content: <div className="pt-4">Conteúdo de configurações.</div>,
            },
          ]}
        />
      </Section>

      {/* 8. DropdownMenu */}
      <Section title="8. DropdownMenu">
        <DropdownMenu
          trigger={<Button>Abrir menu</Button>}
          items={[
            { label: "Perfil", onSelect: () => {} },
            { label: "Configurações", onSelect: () => {} },
            { label: "Sair", onSelect: () => {} },
          ]}
        />
      </Section>

      {/* 9. ScrollArea */}
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

      {/* 10. EmptyState */}
      <Section title="10. EmptyState">
        <EmptyState
          icon={Inbox}
          title="Nenhum item ainda"
          description="Crie seu primeiro item para começar."
          action={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar item
            </Button>
          }
        />
      </Section>

      {/* 11. ErrorState */}
      <Section title="11. ErrorState">
        <ErrorState
          title="Falha ao carregar"
          description="Não foi possível carregar os dados."
          details="Error: network timeout after 30000ms"
          action={<Button variant="outline">Tentar novamente</Button>}
        />
      </Section>

      {/* 12. Breadcrumb */}
      <Section title="12. Breadcrumb">
        <Breadcrumb
          items={[
            { label: "Home", href: "/", icon: Home },
            { label: "Settings", href: "/settings" },
            { label: "Profile" },
          ]}
          separator={<ChevronRight className="h-4 w-4" />}
        />
      </Section>

      {/* 13. PageHeader */}
      <Section title="13. PageHeader">
        <PageHeader
          icon={Users}
          iconColor="violet"
          title="Usuários"
          description="Gerencie os membros da sua empresa."
          actions={
            <>
              <Button variant="outline">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </>
          }
        />
      </Section>

      {/* 14. AppShell */}
      <Section title="14. AppShell">
        <div className="border border-border rounded-md overflow-hidden h-64">
          <AppShell
            sidebar={
              <div className="p-4 space-y-2 text-sm">
                <div className="font-semibold">Nav</div>
                <div>Item 1</div>
                <div>Item 2</div>
                <div>Item 3</div>
              </div>
            }
            header={
              <div className="px-4 py-2 border-b border-border">
                Header do AppShell
              </div>
            }
          >
            <div className="p-4">Conteúdo principal do AppShell.</div>
          </AppShell>
        </div>
      </Section>
    </div>
  );
}
