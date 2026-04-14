import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { getOpportunities } from "@/lib/actions/opportunities";
import type { OpportunityItem } from "@/lib/actions/opportunities";
import { PipelineContent } from "./_components/pipeline-content";
import type { OpportunityStage } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canEdit = userHasPermission(user, "opportunities:edit");
  const result = await getOpportunities();
  const raw: OpportunityItem[] = result.success && result.data ? result.data : [];

  const opportunities = raw.map((o) => ({
    id: o.id,
    title: o.title,
    stage: o.stage as OpportunityStage,
    value: o.value !== null ? Number(o.value) : null,
    currency: o.currency ?? "BRL",
    probability: o.probability,
    contact: o.contact
      ? {
          id: o.contactId ?? "",
          name: `${o.contact.firstName} ${o.contact.lastName}`.trim(),
        }
      : null,
  }));

  return <PipelineContent opportunities={opportunities} canEdit={canEdit} />;
}
