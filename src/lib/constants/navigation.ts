import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  Target,
  Contact,
  TrendingUp,
  LayoutGrid,
  Package,
  CheckSquare,
  Megaphone,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  allowedRoles?: string[];
}

// Itens de navegação sem restrição de role
export const MAIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Contatos", href: "/contacts", icon: Contact },
  { label: "Oportunidades", href: "/opportunities", icon: TrendingUp },
  { label: "Pipeline", href: "/opportunities/pipeline", icon: LayoutGrid },
  { label: "Empresas", href: "/companies", icon: Building2 },
  { label: "Produtos", href: "/products", icon: Package },
  { label: "Tarefas", href: "/tasks", icon: CheckSquare },
  { label: "Marketing", href: "/marketing/campaigns", icon: Megaphone },
  { label: "Automações", href: "/automation/workflows", icon: Workflow },
];

// Itens restritos por role
export const RESTRICTED_NAV_ITEMS: NavItem[] = [
  {
    label: "Usuários",
    href: "/users",
    icon: Users,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "Configurações",
    href: "/settings",
    icon: Settings,
    allowedRoles: ["super_admin", "admin"],
  },
];

// Retorna todos os itens visíveis para o role atual
export function getNavItems(platformRole: string): NavItem[] {
  const restricted = RESTRICTED_NAV_ITEMS.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(platformRole)
  );
  return [...MAIN_NAV_ITEMS, ...restricted];
}
