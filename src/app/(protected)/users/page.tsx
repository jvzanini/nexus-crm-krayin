import { redirect } from "next/navigation";
import { UsersContent } from "@nexusai360/users-ui";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserRole,
} from "@/lib/actions/users";
import { getCurrentUser } from "@/lib/auth";

export default async function UsersPage() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.platformRole !== "super_admin" && u.platformRole !== "admin") {
    redirect("/dashboard");
  }
  return (
    <UsersContent
      isSuperAdmin={u.isSuperAdmin}
      currentUserId={u.id}
      actions={{ getUsers, createUser, updateUser, deleteUser, toggleUserRole }}
    />
  );
}
