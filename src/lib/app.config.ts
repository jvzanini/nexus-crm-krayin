// App Config — Identidade centralizada do Nexus CRM
// Gerado via Blueprint Nexus AI v2.0.0 em 2026-04-11

export const APP_CONFIG = {
  // === Identidade ===
  name: "Nexus CRM",
  shortName: "CRM",
  description: "Gestão de leads, contatos, oportunidades e pipeline de vendas com automação",
  domain: "crm.nexusai360.com",

  // === Visual ===
  logo: "/logo.png",
  brandDark: "/marca-dark.png",
  brandLight: "/marca-light.png",

  // === Email ===
  emailFrom: "Nexus CRM <contato@nexusai360.com>",
  emailDomain: "nexusai360.com",

  // === Deploy ===
  registry: "ghcr.io/jvzanini",
  projectSlug: "nexus-crm-krayin",
  network: "rede_nexusAI",

  // === Módulos habilitados ===
  features: {
    multiTenant: true,
    notifications: true,
    auditLog: true,
    realtime: true,
    encryption: true,
    toast: true,
    dashboard: true,
    queue: true,
    settings: true,
    billing: false,
    apiKeys: true,
    onboarding: false,
    search: true,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
