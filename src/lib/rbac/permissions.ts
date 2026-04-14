/**
 * Matriz de permissões do Nexus CRM — fonte única.
 *
 * Adicionar permission: estender `PERMISSIONS` e, em cada role relevante, incluir
 * a string em `ROLE_PERMISSIONS`. Tudo é `as const` → type-checked no consumo.
 *
 * Convenção: `<módulo>:<ação>`. Ações: view, create, edit, delete, manage.
 * `manage` implica todas demais do módulo.
 */

export const PERMISSIONS = [
  "leads:view",
  "leads:create",
  "leads:edit",
  "leads:delete",
  "contacts:view",
  "contacts:create",
  "contacts:edit",
  "contacts:delete",
  "opportunities:view",
  "opportunities:create",
  "opportunities:edit",
  "opportunities:delete",
  "products:view",
  "products:create",
  "products:edit",
  "products:delete",
  "companies:view",
  "companies:manage",
  "users:view",
  "users:manage",
  "settings:view",
  "settings:edit",
  "flags:manage",
  "audit:view",
  "api-keys:manage",
  "activities:view",
  "activities:create",
  "activities:edit",
  "activities:delete",
  "activities:complete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Platform-level roles já existentes em PlatformRole + default viewer. */
export type Role =
  | "super_admin"
  | "admin"
  | "manager"
  | "seller"
  | "viewer";

/**
 * Expande `<módulo>:manage` para todas as ações CRUD do módulo + a própria manage.
 */
function allOf(
  mod: "leads" | "contacts" | "opportunities" | "products" | "activities",
): Permission[] {
  return [
    `${mod}:view`,
    `${mod}:create`,
    `${mod}:edit`,
    `${mod}:delete`,
  ] as Permission[];
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: [...PERMISSIONS],

  admin: [
    ...allOf("leads"),
    ...allOf("contacts"),
    ...allOf("opportunities"),
    ...allOf("products"),
    ...allOf("activities"),
    "activities:complete",
    "companies:view",
    "companies:manage",
    "users:view",
    "users:manage",
    "settings:view",
    "settings:edit",
    "flags:manage",
    "audit:view",
    "api-keys:manage",
  ],

  manager: [
    ...allOf("leads"),
    ...allOf("contacts"),
    ...allOf("opportunities"),
    ...allOf("products"),
    ...allOf("activities"),
    "activities:complete",
    "companies:view",
    "users:view",
    "settings:view",
    "audit:view",
  ],

  seller: [
    "leads:view",
    "leads:create",
    "leads:edit",
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "opportunities:view",
    "opportunities:create",
    "opportunities:edit",
    "products:view",
    "activities:view",
    "activities:create",
    "activities:edit",
    "activities:complete",
  ],

  viewer: [
    "leads:view",
    "contacts:view",
    "opportunities:view",
    "products:view",
    "companies:view",
    "settings:view",
    "activities:view",
  ],
};

export function isValidRole(role: string): role is Role {
  return role in ROLE_PERMISSIONS;
}
