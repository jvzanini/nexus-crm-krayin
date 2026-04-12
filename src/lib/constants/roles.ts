// Constantes centralizadas de roles — PlatformRole + CompanyRole

export const PLATFORM_ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  viewer: 1,
};

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Gerente",
  viewer: "Visualizador",
};

export const PLATFORM_ROLE_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  super_admin: {
    label: "Super Admin",
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  admin: {
    label: "Admin",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  manager: {
    label: "Gerente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  viewer: {
    label: "Visualizador",
    className: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
};

export const PLATFORM_ROLE_OPTIONS = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Acesso irrestrito a tudo",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Gerencia usuários e configurações",
  },
  {
    value: "manager",
    label: "Gerente",
    description: "Gerencia leads e oportunidades",
  },
  {
    value: "viewer",
    label: "Visualizador",
    description: "Apenas visualização",
  },
];

export const COMPANY_ROLE_HIERARCHY: Record<string, number> = {
  company_admin: 3,
  manager: 2,
  viewer: 1,
};

export const COMPANY_ROLE_LABELS: Record<string, string> = {
  company_admin: "Admin",
  manager: "Gerente",
  viewer: "Visualizador",
};

export const COMPANY_ROLE_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  company_admin: {
    label: "Admin",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  manager: {
    label: "Gerente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  viewer: {
    label: "Visualizador",
    className: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
};

export const COMPANY_ROLE_OPTIONS = [
  {
    value: "company_admin",
    label: "Admin",
    description: "Gerencia a empresa",
    bg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  },
  {
    value: "manager",
    label: "Gerente",
    description: "Gerencia leads e contatos",
    bg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
  {
    value: "viewer",
    label: "Visualizador",
    description: "Apenas visualização",
    bg: "bg-zinc-800 border-zinc-700 text-zinc-400",
  },
];
