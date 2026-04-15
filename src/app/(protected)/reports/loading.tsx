import { PageHeader, Skeleton } from "@nexusai360/design-system";
import { BarChart3 } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader.Root>
        <PageHeader.Row>
          <PageHeader.Icon icon={BarChart3} color="violet" />
          <PageHeader.Heading>
            <PageHeader.Title>Relatórios</PageHeader.Title>
            <PageHeader.Description>Carregando…</PageHeader.Description>
          </PageHeader.Heading>
        </PageHeader.Row>
      </PageHeader.Root>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
