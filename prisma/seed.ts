import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // System user — usado como createdBy em actions automatizadas (ex.: automation create-task).
  // UUID fixo nil para referenciar em código sem depender de lookup.
  const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
  const systemPassword = await bcrypt.hash(`system-${Date.now()}-${Math.random()}`, 12);
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {
      isActive: true,
      platformRole: "super_admin",
    },
    create: {
      id: SYSTEM_USER_ID,
      email: "system@nexuscrm.internal",
      name: "Sistema",
      password: systemPassword,
      platformRole: "super_admin",
      isSuperAdmin: true,
      isActive: true,
    },
  });
  console.log(`System user garantido (id=${SYSTEM_USER_ID})`);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      platformRole: "super_admin",
      isSuperAdmin: true,
      isActive: true,
    },
    create: {
      email,
      name: "Super Admin",
      password: hashedPassword,
      platformRole: "super_admin",
      isSuperAdmin: true,
      isActive: true,
    },
  });

  console.log(`Super admin criado/atualizado: ${user.email}`);

  // Criar companies de demo
  const demoCompanies = [
    { name: "Nexus AI", slug: "nexus-ai" },
    { name: "Tech Solutions", slug: "tech-solutions" },
  ];

  const companies = [];
  for (const companyData of demoCompanies) {
    const company = await prisma.company.upsert({
      where: { slug: companyData.slug },
      update: {},
      create: { name: companyData.name, slug: companyData.slug },
    });
    companies.push(company);
    console.log(`Company criada/encontrada: ${company.name}`);
  }

  // Demo products (6 produtos: 3 serviços + 3 licenças)
  const demoProducts = [
    {
      sku: "SVC-001",
      name: "Consultoria estratégica",
      category: "Serviços",
      prices: [
        { currency: "BRL", amount: "5000.00" },
        { currency: "USD", amount: "1000.00" },
      ],
    },
    {
      sku: "SVC-002",
      name: "Implementação técnica",
      category: "Serviços",
      prices: [{ currency: "BRL", amount: "15000.00" }],
    },
    {
      sku: "SVC-003",
      name: "Suporte mensal",
      category: "Serviços",
      prices: [{ currency: "BRL", amount: "2500.00" }],
    },
    {
      sku: "LIC-001",
      name: "Licença anual básica",
      category: "Licenças",
      prices: [{ currency: "BRL", amount: "1200.00" }],
    },
    {
      sku: "LIC-002",
      name: "Licença anual pro",
      category: "Licenças",
      prices: [
        { currency: "BRL", amount: "3600.00" },
        { currency: "USD", amount: "720.00" },
      ],
    },
    {
      sku: "LIC-003",
      name: "Add-on de integração",
      category: "Licenças",
      prices: [{ currency: "BRL", amount: "480.00" }],
    },
  ];

  // Garantir membership super_admin para o super-admin em cada company demo.
  // Necessário porque `requireActiveCompanyId()` exige membership explícita
  // mesmo para super-admin (LEI law_superadmin_seed).
  for (const company of companies) {
    await prisma.userCompanyMembership.upsert({
      where: {
        userId_companyId: { userId: user.id, companyId: company.id },
      },
      update: { isActive: true, role: "super_admin" },
      create: {
        userId: user.id,
        companyId: company.id,
        role: "super_admin",
        isActive: true,
      },
    });
    console.log(`Membership super_admin garantida em ${company.slug}`);
  }

  // Feature flags — Fase 5 Custom Attributes (default OFF; habilitado por
  // tenant via FeatureFlagOverride).
  await prisma.featureFlag.upsert({
    where: { key: "feature.custom_attributes" },
    update: {},
    create: {
      key: "feature.custom_attributes",
      enabled: false,
      description:
        "Custom attributes (Fase 5) — habilitar por tenant via override",
    },
  });
  console.log("Feature flag feature.custom_attributes garantida (enabled=false)");

  for (const company of companies) {
    for (const p of demoProducts) {
      const product = await prisma.product.upsert({
        where: {
          uq_product_sku_per_company: { companyId: company.id, sku: p.sku },
        },
        update: {},
        create: {
          companyId: company.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          active: true,
          prices: {
            create: p.prices.map((pr) => ({
              currency: pr.currency,
              amount: pr.amount,
            })),
          },
        },
      });
      console.log(
        `Produto criado/encontrado: ${product.sku} em ${company.name}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
