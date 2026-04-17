import { describe, expect, it } from "vitest";
import { userHasPermission } from "../check";

const mkUser = (role: string, isSuperAdmin = false) => ({
  platformRole: role,
  isSuperAdmin,
});

describe("rbac — custom-attributes permissions (Fase 5)", () => {
  it("admin tem view e manage de custom-attributes", () => {
    const admin = mkUser("admin");
    expect(userHasPermission(admin, "custom-attributes:view")).toBe(true);
    expect(userHasPermission(admin, "custom-attributes:manage")).toBe(true);
  });

  it("manager tem apenas view — não manage", () => {
    const manager = mkUser("manager");
    expect(userHasPermission(manager, "custom-attributes:view")).toBe(true);
    expect(userHasPermission(manager, "custom-attributes:manage")).toBe(false);
  });

  it("viewer tem apenas view — não manage", () => {
    const viewer = mkUser("viewer");
    expect(userHasPermission(viewer, "custom-attributes:view")).toBe(true);
    expect(userHasPermission(viewer, "custom-attributes:manage")).toBe(false);
  });

  it("seller não tem view nem manage (spec v3 §3.5 — role removida da matriz)", () => {
    // I15 spec v3: seller não consta na matriz RBAC de custom-attributes.
    // Note que a role ainda existe no código legado (inexistente no enum DB).
    const seller = mkUser("seller");
    expect(userHasPermission(seller, "custom-attributes:view")).toBe(false);
    expect(userHasPermission(seller, "custom-attributes:manage")).toBe(false);
  });

  it("super_admin tem view e manage (via spread total)", () => {
    const sa = mkUser("admin", true);
    expect(userHasPermission(sa, "custom-attributes:view")).toBe(true);
    expect(userHasPermission(sa, "custom-attributes:manage")).toBe(true);
  });
});
