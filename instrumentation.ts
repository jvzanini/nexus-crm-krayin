/**
 * Next.js instrumentation hook (Fase 1c.0.f).
 *
 * - Server runtime: carrega Sentry SDK + OTel SDK condicional a env vars.
 * - Edge runtime: Sentry edge config apenas.
 *
 * Sem DSN/endpoint, SDKs são no-op (não crasham).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Sentry só carrega quando DSN presente (evita side-effects em SSR sem config).
    if (process.env.SENTRY_DSN) {
      await import("./sentry.server.config");
    }

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
        instrumentations: [
          new HttpInstrumentation(),
          new PgInstrumentation(),
        ],
      });
      sdk.start();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    if (process.env.SENTRY_DSN) {
      await import("./sentry.edge.config");
    }
  }
}
