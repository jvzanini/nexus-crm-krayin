import { defineConfig } from "@prisma/config";
import "dotenv/config";

/**
 * Datasource configuration para Prisma 7.
 *
 * - `url`: connection string usada pelo client em runtime e pelos comandos
 *   `prisma generate` / `prisma db push`.
 * - `shadowDatabaseUrl`: opcional; usado por `prisma migrate dev`. Se a infra
 *   futura introduzir pgBouncer (pooler), `DIRECT_URL` deve apontar para a
 *   conexão sem pool (exigido por `CREATE INDEX CONCURRENTLY`).
 *
 * Fallback: se `DIRECT_URL` não estiver definido, `DATABASE_URL` é usado.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
