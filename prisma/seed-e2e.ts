/**
 * Seed idempotente para Playwright E2E.
 * Cria: 2 companies, 3 users (admin/manager/viewer), memberships em tenant A.
 * NÃO cria leads/contacts — escopo multi-tenant desses models ainda pendente.
 *
 * Uso: `npm run test:e2e:seed` (requer DATABASE_URL setado).
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  E2E_PASSWORD,
  TENANT_A,
  TENANT_B,
  E2E_USERS,
} from "../tests/e2e/fixtures/e2e-users";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashed = await bcrypt.hash(E2E_PASSWORD, 8);

  for (const t of [TENANT_A, TENANT_B]) {
    await prisma.company.upsert({
      where: { id: t.id },
      update: { name: t.name, slug: t.slug },
      create: { id: t.id, name: t.name, slug: t.slug },
    });
    console.log(`E2E company: ${t.name}`);
  }

  for (const [role, cfg] of Object.entries(E2E_USERS)) {
    const user = await prisma.user.upsert({
      where: { email: cfg.email },
      update: {
        name: cfg.name,
        platformRole: cfg.platformRole,
        isSuperAdmin: false,
        isActive: true,
        password: hashed,
      },
      create: {
        email: cfg.email,
        name: cfg.name,
        platformRole: cfg.platformRole,
        isSuperAdmin: false,
        isActive: true,
        password: hashed,
      },
    });

    const companyRole =
      cfg.platformRole === "admin" ? "company_admin" : cfg.platformRole;

    await prisma.userCompanyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: TENANT_A.id } },
      update: { role: companyRole, isActive: true },
      create: {
        userId: user.id,
        companyId: TENANT_A.id,
        role: companyRole,
        isActive: true,
      },
    });
    console.log(`E2E ${role}: ${cfg.email} → tenant A (${companyRole})`);
  }

  console.log("E2E seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
