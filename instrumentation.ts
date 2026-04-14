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
