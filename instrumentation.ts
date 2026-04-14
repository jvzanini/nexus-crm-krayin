/**
 * Next.js instrumentation hook.
 * OTel SDK carrega condicional a OTEL_EXPORTER_OTLP_ENDPOINT.
 * Sentry completamente removido (sem SDK ativo; re-integrar em Fase 12).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Rate-limit singleton: best-effort — se @nexusai360/core ou redis falharem,
    // logger warn e continua (login funciona sem rate-limit customizado).
    try {
      const { configureRateLimit } = await import("@nexusai360/core");
      const { redis } = await import("@/lib/redis");
      configureRateLimit(redis);
    } catch (err) {
      console.warn("[instrumentation] configureRateLimit falhou:", err);
    }

    // Company adapter (multi-tenant): registra PrismaCompanyAdapter no pacote
    // para que getCompanyAdapter()/wrappers possam acessar Prisma do CRM.
    try {
      const { configureCompanies } = await import("@nexusai360/multi-tenant");
      const { companyAdapter } = await import("@/lib/multi-tenant/adapter");
      configureCompanies(companyAdapter);
    } catch (err) {
      console.warn("[instrumentation] configureCompanies falhou:", err);
    }

    // Audit-log persist: registra callback Prisma no @nexusai360/audit-log
    // para que logAudit(entry) persista via prisma.auditLog.create.
    try {
      const { configureAudit } = await import("@nexusai360/audit-log");
      const { auditPersist } = await import("@/lib/audit-log/persist");
      configureAudit(auditPersist);
    } catch (err) {
      console.warn("[instrumentation] configureAudit falhou:", err);
    }

    // Settings-UI permission resolver: alinha vendor com matriz RBAC do CRM
    // (vendor default não inclui flags:manage para admin).
    try {
      const { setPermissionResolver } = await import(
        "@nexusai360/settings-ui/server-helpers"
      );
      const { ROLE_PERMISSIONS } = await import("@/lib/rbac");
      setPermissionResolver((role) => {
        const perms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [];
        return perms.filter((p) =>
          p === "settings:view" || p === "settings:edit" || p === "flags:manage",
        ) as readonly ("settings:view" | "settings:edit" | "flags:manage")[];
      });
    } catch (err) {
      console.warn("[instrumentation] setPermissionResolver settings-ui falhou:", err);
    }

    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { OTLPTraceExporter } = await import(
        "@opentelemetry/exporter-trace-otlp-http"
      );
      const { HttpInstrumentation } = await import(
        "@opentelemetry/instrumentation-http"
      );
      const { PgInstrumentation } = await import(
        "@opentelemetry/instrumentation-pg"
      );
      const { Resource } = await import("@opentelemetry/resources");
      const { SemanticResourceAttributes } = await import(
        "@opentelemetry/semantic-conventions"
      );

      const sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: "nexus-crm",
          [SemanticResourceAttributes.SERVICE_VERSION]:
            process.env.APP_VERSION ?? "unknown",
        }),
        traceExporter: new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        }),
        instrumentations: [new HttpInstrumentation(), new PgInstrumentation()],
      });
      sdk.start();
    }
  }
}
