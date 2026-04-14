import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import {
  PermissionDeniedError,
  getUserPermissions as getUserPermissionsPure,
  userHasPermission as userHasPermissionPure,
} from "./check";
import type { Permission } from "./permissions";

export type { Permission, Role } from "./permissions";
export { PERMISSIONS, ROLE_PERMISSIONS, isValidRole } from "./permissions";
export {
  PermissionDeniedError,
  getUserPermissions,
  userHasPermission,
} from "./check";

function toRbacUser(user: Pick<CurrentUser, "platformRole" | "isSuperAdmin">) {
  return {
    platformRole: user.platformRole,
    isSuperAdmin: user.isSuperAdmin,
  };
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return userHasPermissionPure(toRbacUser(user), permission);
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new PermissionDeniedError(permission);
  if (!userHasPermissionPure(toRbacUser(user), permission)) {
    throw new PermissionDeniedError(permission);
  }
  return user;
}

// Re-export para backward compat
export { getUserPermissionsPure };
