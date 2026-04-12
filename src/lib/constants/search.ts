// Configuração da busca global do Nexus CRM

export const SEARCH_CONFIG = {
  debounceMs: 300,
  minChars: 2,
  maxResults: 5,
  entities: ["users", "companies", "leads", "contacts", "opportunities"] as const,
} as const;

export type SearchEntity = typeof SEARCH_CONFIG.entities[number];

export const SEARCH_ENTITY_LABELS: Record<SearchEntity, string> = {
  users: "Usuários",
  companies: "Empresas",
  leads: "Leads",
  contacts: "Contatos",
  opportunities: "Oportunidades",
};

export const SEARCH_ENTITY_ROUTES: Record<SearchEntity, string> = {
  users: "/users",
  companies: "/companies",
  leads: "/leads",
  contacts: "/contacts",
  opportunities: "/opportunities",
};
