import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
