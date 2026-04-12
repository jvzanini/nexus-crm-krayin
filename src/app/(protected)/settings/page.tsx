import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SettingsContent } from "./_components/settings-content";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!["super_admin", "admin"].includes(user.platformRole)) {
    redirect("/dashboard");
  }

  return <SettingsContent />;
}
