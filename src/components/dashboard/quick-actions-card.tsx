import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nexusai360/design-system";
import { Plus, Zap } from "lucide-react";

export async function QuickActionsCard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const items = [
    { href: "/leads/new", label: "Novo lead", perm: "leads:create" as const },
    {
      href: "/contacts/new",
      label: "Novo contato",
      perm: "contacts:create" as const,
    },
    {
      href: "/opportunities/new",
      label: "Nova oportunidade",
      perm: "opportunities:create" as const,
    },
  ].filter((i) => userHasPermission(user, i.perm));

  return (
    <Card className="bg-card border border-border rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-400" />
          Ações rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem permissões para atalhos rápidos.
          </p>
        ) : (
          items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-foreground hover:bg-muted/50 hover:border-violet-500/40 transition-colors"
            >
              <Plus className="h-4 w-4 text-violet-400" />
              {it.label}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
