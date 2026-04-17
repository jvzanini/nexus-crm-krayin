import { listTasks } from "@/lib/actions/activities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nexusai360/design-system";
import { Calendar } from "lucide-react";

export async function UpcomingMeetingsCard() {
  const result = await listTasks({
    status: "pending",
    assigneeScope: "me",
    dueWithinDays: "7",
  });

  const items = result.success
    ? (result.data ?? [])
        .filter((a) => a.type === "meeting" || a.type === "call")
        .slice(0, 3)
    : [];

  return (
    <Card className="bg-card border border-border rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-400" />
          Próximos encontros
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum encontro agendado nos próximos 7 dias.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="text-sm text-foreground truncate">
                {it.title}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
