import { describe, expect, it } from "vitest";
import { userHasPermission } from "../check";
import type { Permission } from "../permissions";

const mkUser = (role: string, isSuperAdmin = false) => ({
  platformRole: role,
  isSuperAdmin,
});

/**
 * Matriz canônica RBAC — Fase 10 DataTransfer (spec v3 §3.10).
 *
 *  Permission                          | super_admin | admin | manager | seller | viewer
 *  ------------------------------------|:-----------:|:-----:|:-------:|:------:|:------:
 *  data-transfer:import                | YES         | YES   | YES     | NO     | NO
 *  data-transfer:import:rollback       | YES         | YES   | NO      | NO     | NO
 *  data-transfer:export                | YES         | YES   | YES     | YES    | YES
 *  data-transfer:history:read          | YES         | YES   | YES     | YES    | YES
 *  data-transfer:history:all           | YES         | NO    | NO      | NO     | NO
 *
 * Total = 5 perms × 5 roles = 25 cases. Tabela única, table-driven.
 */
type Role = "super_admin" | "admin" | "manager" | "seller" | "viewer";

const matrix: Array<{
  perm: Permission;
  expected: Record<Role, boolean>;
}> = [
  {
    perm: "data-transfer:import" as Permission,
    expected: { super_admin: true, admin: true, manager: true, seller: false, viewer: false },
  },
  {
    perm: "data-transfer:import:rollback" as Permission,
    expected: { super_admin: true, admin: true, manager: false, seller: false, viewer: false },
  },
  {
    perm: "data-transfer:export" as Permission,
    expected: { super_admin: true, admin: true, manager: true, seller: true, viewer: true },
  },
  {
    perm: "data-transfer:history:read" as Permission,
    expected: { super_admin: true, admin: true, manager: true, seller: true, viewer: true },
  },
  {
    perm: "data-transfer:history:all" as Permission,
    expected: { super_admin: true, admin: false, manager: false, seller: false, viewer: false },
  },
];

const userFor = (role: Role) =>
  role === "super_admin" ? mkUser("admin", true) : mkUser(role);

describe("rbac — data-transfer permissions (Fase 10)", () => {
  for (const { perm, expected } of matrix) {
    for (const role of Object.keys(expected) as Role[]) {
      const should = expected[role] ? "PERMITE" : "BLOQUEIA";
      it(`${role} ${should} ${perm}`, () => {
        expect(userHasPermission(userFor(role), perm)).toBe(expected[role]);
      });
    }
  }
});
