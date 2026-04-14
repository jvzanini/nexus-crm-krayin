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
    await import("./sentry.server.config");

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
    await import("./sentry.edge.config");
  }
}
