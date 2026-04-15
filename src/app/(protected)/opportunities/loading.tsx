import { PageHeader, Skeleton, Card } from "@nexusai360/design-system";
import { TrendingUp } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader.Root>
        <PageHeader.Row>
          <PageHeader.Icon icon={TrendingUp} color="amber" />
          <PageHeader.Heading>
            <PageHeader.Title>Oportunidades</PageHeader.Title>
            <PageHeader.Description>Carregando…</PageHeader.Description>
          </PageHeader.Heading>
        </PageHeader.Row>
      </PageHeader.Root>
      <Card className="border-border bg-card/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-9 w-full max-w-sm" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
