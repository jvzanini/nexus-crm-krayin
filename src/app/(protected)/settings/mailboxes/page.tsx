import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac/check";
import { MailboxesContent } from "./_components/mailboxes-content";

export const dynamic = "force-dynamic";

export default async function MailboxesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userHasPermission(user, "email:view")) redirect("/dashboard");

  const canManage = userHasPermission(user, "email:manage");
  const canConnect = userHasPermission(user, "email:connect");
  const googleConfigured = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID);
  const outlookConfigured = Boolean(process.env.MS_OAUTH_CLIENT_ID);

  return (
    <MailboxesContent
      canManage={canManage}
      canConnect={canConnect}
      googleConfigured={googleConfigured}
      outlookConfigured={outlookConfigured}
    />
  );
}
