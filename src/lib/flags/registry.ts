/**
 * Registry estático de feature flags conhecidas pelo CRM.
 *
 * Cada entrada documenta:
 * - `key`: identificador canônico usado em `getFlag(key, ctx)`.
 * - `defaultEnabled`: valor padrão quando a flag ainda não existe no banco
 *    (`feature_flags` table). `getFlag` retorna `false` se ausente — esta
 *    constante é usada por seeds/migrations idempotentes para popular o DB
 *    com o valor inicial sem mexer em flags já configuradas.
 * - `description`: documentação humana (também escrita em `feature_flags.description`).
 * - `phase`: fase canônica do roadmap (rastreabilidade).
 *
 * Adicionar uma nova flag:
 * 1. Acrescentar entry aqui.
 * 2. Rodar seed (`prisma/seed.ts`) ou usar `setFlag(key, { enabled, ... }, actor)` em runtime.
 * 3. Consumir via `await getFlag(key, { companyId, userId })`.
 */
export interface FlagRegistryEntry {
  key: string;
  defaultEnabled: boolean;
  description: string;
  phase: string;
}

export const FLAG_REGISTRY: readonly FlagRegistryEntry[] = [
  {
    key: "data_transfer",
    defaultEnabled: false,
    description:
      "Habilita o módulo /settings/data-transfer (import/export CSV/XLSX). " +
      "Rollout gradual: staging → 1 tenant piloto → 25% → 50% → 100%.",
    phase: "10",
  },
] as const;

export function getRegisteredFlag(key: string): FlagRegistryEntry | undefined {
  return FLAG_REGISTRY.find((f) => f.key === key);
}
