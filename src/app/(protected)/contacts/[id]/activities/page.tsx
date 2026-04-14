import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { prisma } from "@/lib/prisma";
import { ActivityTimeline } from "@/components/activity/activity-timeline";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactActivitiesPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "activities:view")) redirect("/dashboard");

  // Buscar o contato verificando tenant scope
  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId: user.id, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) redirect("/dashboard");

  // Contact não tem companyId no schema. Também não tem `name` — tem firstName + lastName.
  const contact = await prisma.contact.findFirst({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!contact) notFound();

  const contactName = `${contact.firstName} ${contact.lastName}`.trim();

  const canCreate = userHasPermission(user, "activities:create");
  const canEdit = userHasPermission(user, "activities:edit");
  const canDelete = userHasPermission(user, "activities:delete");
  const canComplete = userHasPermission(user, "activities:complete");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {/* TODO T7: extract to i18n key activities.breadcrumb.contact */}
        <span>Contato:</span>
        <span className="font-medium text-foreground">{contactName}</span>
      </div>
      <ActivityTimeline
        subjectType="contact"
        subjectId={contact.id}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canComplete={canComplete}
      />
    </div>
  );
}
