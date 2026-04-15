// Configuração da busca global do Nexus CRM

export const SEARCH_CONFIG = {
  debounceMs: 300,
  minChars: 2,
  maxResults: 5,
  entities: [
    "leads",
    "contacts",
    "opportunities",
    "products",
    "tasks",
    "workflows",
    "campaigns",
    "segments",
    "users",
    "companies",
  ] as const,
} as const;

export type SearchEntity = typeof SEARCH_CONFIG.entities[number];

export const SEARCH_ENTITY_LABELS: Record<SearchEntity, string> = {
  leads: "Leads",
  contacts: "Contatos",
  opportunities: "Oportunidades",
  products: "Produtos",
  tasks: "Tarefas",
  workflows: "Automações",
  campaigns: "Campanhas",
  segments: "Segmentos",
  users: "Usuários",
  companies: "Empresas",
};

export const SEARCH_ENTITY_ORDER: readonly SearchEntity[] = SEARCH_CONFIG.entities;
