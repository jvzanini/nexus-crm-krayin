/**
 * E2E fixtures. IDs fixos para specs cross-tenant e seeds idempotentes.
 * Tenant A = principal. Tenant B = apenas para smoke cross-tenant (ainda não
 * há scoping por companyId em Lead/Contact/Opportunity — ver HANDOFF).
 */
export const E2E_PASSWORD = "E2E-Test-Pass-2026!";

export const TENANT_A = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "e2e-tenant-a",
  name: "E2E Tenant A",
};

export const TENANT_B = {
  id: "22222222-2222-2222-2222-222222222222",
  slug: "e2e-tenant-b",
  name: "E2E Tenant B",
};

export type E2ERole = "admin" | "manager" | "viewer";

export const E2E_USERS: Record<
  E2ERole,
  { email: string; name: string; platformRole: "admin" | "manager" | "viewer" }
> = {
  admin:   { email: "e2e-admin@nexus.test",   name: "E2E Admin",   platformRole: "admin" },
  manager: { email: "e2e-manager@nexus.test", name: "E2E Manager", platformRole: "manager" },
  viewer:  { email: "e2e-viewer@nexus.test",  name: "E2E Viewer",  platformRole: "viewer" },
};

export const E2E_FIXTURES = {
  // ID UUID válido mas inexistente — usado para smoke 404 no cross-tenant spec.
  nonExistentLeadId: "99999999-9999-9999-9999-999999999999",
};
