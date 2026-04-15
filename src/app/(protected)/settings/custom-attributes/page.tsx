/**
 * Fase 5 T14/34 — settings UI /settings/custom-attributes.
 *
 * Guard triple-layer:
 *   1. feature.custom_attributes flag OFF  → 404 (feature não existe publicamente).
 *   2. Sem sessão                           → redirect /login.
 *   3. Sem permission custom-attributes:view → redirect /dashboard.
 *
 * `canManage` resolve via matriz RBAC (custom-attributes:manage) — admin/super_admin
 * acessam CRUD; viewer/manager apenas read-only (sem botão "Novo", sem editar/excluir).
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { getFlag } from "@/lib/flags/index";
import { AttrsContent } from "./_components/attrs-content";

export const dynamic = "force-dynamic";

export default async function CustomAttributesPage() {
  const flagOn = await getFlag("feature.custom_attributes");
  if (!flagOn) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!userHasPermission(user, "custom-attributes:view")) {
    redirect("/dashboard");
  }

  const canManage = userHasPermission(user, "custom-attributes:manage");

  return <AttrsContent canManage={canManage} />;
}
