import { PageHeader, Skeleton } from "@nexusai360/design-system";
import { LayoutGrid } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader.Root>
        <PageHeader.Row>
          <PageHeader.Icon icon={LayoutGrid} color="violet" />
          <PageHeader.Heading>
            <PageHeader.Title>Pipeline</PageHeader.Title>
            <PageHeader.Description>Carregando…</PageHeader.Description>
          </PageHeader.Heading>
        </PageHeader.Row>
      </PageHeader.Root>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-w-[280px] space-y-2">
            <Skeleton className="h-10 rounded-xl" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-24 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
