import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UsersContent } from "./_components/users-content";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!["super_admin", "admin"].includes(user.platformRole)) {
    redirect("/dashboard");
  }

  return (
    <UsersContent
      isSuperAdmin={user.isSuperAdmin}
      currentUserId={user.id}
    />
  );
}
