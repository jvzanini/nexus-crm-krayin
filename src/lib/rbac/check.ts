import {
  ROLE_PERMISSIONS,
  isValidRole,
  type Permission,
  type Role,
} from "./permissions";

export interface RbacUser {
  platformRole: string;
  isSuperAdmin: boolean;
}

export class PermissionDeniedError extends Error {
  constructor(public readonly permission: Permission) {
    super(`PERMISSION_DENIED:${permission}`);
    this.name = "PermissionDeniedError";
  }
}

function userRole(user: RbacUser): Role {
  if (user.isSuperAdmin) return "super_admin";
  if (isValidRole(user.platformRole)) return user.platformRole;
  return "viewer";
}

export function getUserPermissions(user: RbacUser): readonly Permission[] {
  return ROLE_PERMISSIONS[userRole(user)] ?? [];
}

export function userHasPermission(
  user: RbacUser,
  permission: Permission,
): boolean {
  return getUserPermissions(user).includes(permission);
}
