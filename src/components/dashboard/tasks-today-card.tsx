import Link from "next/link";
import { listTasks } from "@/lib/actions/activities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nexusai360/design-system";
import { CheckSquare } from "lucide-react";

export async function TasksTodayCard() {
  const result = await listTasks({
    status: "pending",
    assigneeScope: "me",
    dueWithinDays: "today",
  });

  const items = result.success ? (result.data ?? []).slice(0, 5) : [];

  return (
    <Card className="bg-card border border-border rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-violet-400" />
          Tarefas hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem tarefas pendentes hoje.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((t) => (
              <li key={t.id} className="text-sm">
                <Link
                  href={`/tasks?highlight=${t.id}`}
                  className="block truncate text-foreground hover:text-violet-400 transition-colors"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
