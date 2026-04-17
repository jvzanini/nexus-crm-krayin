import { Suspense } from "react";
import { auth } from "@/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { TasksTodayCard } from "@/components/dashboard/tasks-today-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import {
  Card,
  CardContent,
  CardHeader,
} from "@nexusai360/design-system";
import { redirect } from "next/navigation";

function SideCardSkeleton() {
  return (
    <Card className="bg-card border border-border rounded-xl">
      <CardHeader className="pb-3">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const fullName = session.user.name || session.user.email || "Usuário";
  const userName = fullName.split(" ")[0];

  const sideSlots = (
    <>
      <Suspense fallback={<SideCardSkeleton />}>
        <TasksTodayCard />
      </Suspense>
      <Suspense fallback={<SideCardSkeleton />}>
        <UpcomingMeetingsCard />
      </Suspense>
      <Suspense fallback={<SideCardSkeleton />}>
        <QuickActionsCard />
      </Suspense>
    </>
  );

  return <DashboardContent userName={userName} sideSlots={sideSlots} />;
}
