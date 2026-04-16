/**
 * Backfill: garante UserCompanyMembership ativa (role=super_admin) para
 * o usuário super-admin (ADMIN_EMAIL do env) em TODAS as companies ativas
 * do sistema. Idempotente — pode rodar N vezes sem side-effects.
 *
 * Por quê: `requireActiveCompanyId()` exige membership explícita mesmo
 * para super-admin (LEI `law_superadmin_seed`). Sem membership, toda
 * Server Action tenant-scoped falha com "Empresa ativa não encontrada".
 *
 * Execução:
 *   ADMIN_EMAIL=nexusai360@gmail.com npx tsx prisma/scripts/backfill-superadmin-membership.ts
 *
 * Em prod via Portainer:
 *   docker exec <container-app> sh -c 'ADMIN_EMAIL=$ADMIN_EMAIL npx tsx prisma/scripts/backfill-superadmin-membership.ts'
 */

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.error("ADMIN_EMAIL obrigatório.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isSuperAdmin: true, platformRole: true },
  });

  if (!user) {
    console.error(`Usuário com email=${email} não existe. Rode o seed primeiro.`);
    process.exit(1);
  }

  if (!user.isSuperAdmin && user.platformRole !== "super_admin") {
    console.error(
      `Usuário ${email} não é super-admin. Abortando pra não conceder acesso indevido.`,
    );
    process.exit(1);
  }

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (companies.length === 0) {
    console.warn("Nenhuma company ativa encontrada. Nada a fazer.");
    return;
  }

  let created = 0;
  let reactivated = 0;
  let untouched = 0;

  for (const company of companies) {
    const existing = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      select: { id: true, isActive: true, role: true },
    });

    if (!existing) {
      await prisma.userCompanyMembership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: "super_admin",
          isActive: true,
        },
      });
      created++;
      console.log(`✓ Criada membership super_admin em ${company.slug}`);
      continue;
    }

    if (!existing.isActive || existing.role !== "super_admin") {
      await prisma.userCompanyMembership.update({
        where: { id: existing.id },
        data: { isActive: true, role: "super_admin" },
      });
      reactivated++;
      console.log(`↻ Membership reativada em ${company.slug}`);
      continue;
    }

    untouched++;
  }

  console.log(
    `\nResumo: ${created} criadas, ${reactivated} reativadas, ${untouched} já ativas. Total companies: ${companies.length}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
