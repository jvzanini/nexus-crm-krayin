import { describe, expect, it } from "vitest";
import { getUserPermissions, userHasPermission } from "./check";
import { isValidRole, ROLE_PERMISSIONS } from "./permissions";

const mkUser = (role: string, isSuperAdmin = false) => ({
  platformRole: role,
  isSuperAdmin,
});

describe("rbac", () => {
  it("super_admin sempre tem todas as permissions", () => {
    const user = mkUser("admin", true);
    for (const p of ROLE_PERMISSIONS.super_admin) {
      expect(userHasPermission(user, p)).toBe(true);
    }
  });

  it("viewer não cria leads", () => {
    expect(userHasPermission(mkUser("viewer"), "leads:create")).toBe(false);
    expect(userHasPermission(mkUser("viewer"), "leads:view")).toBe(true);
  });

  it("seller cria leads mas não deleta", () => {
    const seller = mkUser("seller");
    expect(userHasPermission(seller, "leads:create")).toBe(true);
    expect(userHasPermission(seller, "leads:edit")).toBe(true);
    expect(userHasPermission(seller, "leads:delete")).toBe(false);
    expect(userHasPermission(seller, "companies:manage")).toBe(false);
  });

  it("manager tem CRUD completo em leads/contacts/opportunities mas não gerencia companies", () => {
    const m = mkUser("manager");
    expect(userHasPermission(m, "leads:delete")).toBe(true);
    expect(userHasPermission(m, "opportunities:delete")).toBe(true);
    expect(userHasPermission(m, "companies:manage")).toBe(false);
    expect(userHasPermission(m, "flags:manage")).toBe(false);
  });

  it("admin gerencia tudo do tenant mas não é super", () => {
    const a = mkUser("admin");
    expect(userHasPermission(a, "flags:manage")).toBe(true);
    expect(userHasPermission(a, "users:manage")).toBe(true);
  });

  it("role inválida cai pra viewer", () => {
    const weird = mkUser("xyz");
    expect(getUserPermissions(weird)).toEqual(ROLE_PERMISSIONS.viewer);
  });

  it("isValidRole discrimina", () => {
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("banana")).toBe(false);
  });

  it("admin tem activities:delete e activities:complete", () => {
    const a = mkUser("admin");
    expect(userHasPermission(a, "activities:delete")).toBe(true);
    expect(userHasPermission(a, "activities:complete")).toBe(true);
  });

  it("manager tem activities:delete e activities:complete", () => {
    const m = mkUser("manager");
    expect(userHasPermission(m, "activities:delete")).toBe(true);
    expect(userHasPermission(m, "activities:complete")).toBe(true);
  });

  it("seller NÃO tem activities:delete mas tem activities:complete", () => {
    const s = mkUser("seller");
    expect(userHasPermission(s, "activities:delete")).toBe(false);
    expect(userHasPermission(s, "activities:complete")).toBe(true);
  });

  it("viewer tem activities:view mas NÃO activities:create/edit/delete/complete", () => {
    const v = mkUser("viewer");
    expect(userHasPermission(v, "activities:view")).toBe(true);
    expect(userHasPermission(v, "activities:create")).toBe(false);
    expect(userHasPermission(v, "activities:edit")).toBe(false);
    expect(userHasPermission(v, "activities:delete")).toBe(false);
    expect(userHasPermission(v, "activities:complete")).toBe(false);
  });

  it("admin tem email:connect e email:manage", () => {
    const a = mkUser("admin");
    expect(userHasPermission(a, "email:connect")).toBe(true);
    expect(userHasPermission(a, "email:manage")).toBe(true);
  });

  it("manager tem email:send e email:manage mas NÃO email:connect", () => {
    const m = mkUser("manager");
    expect(userHasPermission(m, "email:send")).toBe(true);
    expect(userHasPermission(m, "email:manage")).toBe(true);
    expect(userHasPermission(m, "email:connect")).toBe(false);
  });

  it("seller tem email:view e email:send mas NÃO email:connect nem email:manage", () => {
    const s = mkUser("seller");
    expect(userHasPermission(s, "email:view")).toBe(true);
    expect(userHasPermission(s, "email:send")).toBe(true);
    expect(userHasPermission(s, "email:connect")).toBe(false);
    expect(userHasPermission(s, "email:manage")).toBe(false);
  });

  it("viewer tem email:view mas NÃO email:send", () => {
    const v = mkUser("viewer");
    expect(userHasPermission(v, "email:view")).toBe(true);
    expect(userHasPermission(v, "email:send")).toBe(false);
  });
});
