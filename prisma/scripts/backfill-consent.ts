/**
 * Backfill de consent LGPD para registros pré-Fase 1b.
 *
 * Para cada Lead / Contact existente, garante 1 log por chave (marketing,
 * tracking) com `source='backfill_migration'`, `granted=false`,
 * `reason='Registro pré-1b; consent pendente'`.
 *
 * Idempotente: verifica se já existe log backfill antes de inserir.
 * Pode ser rodado múltiplas vezes sem gerar duplicatas.
 *
 * Uso:
 *   npx tsx prisma/scripts/backfill-consent.ts
 */
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const REASON = "Registro pré-1b; consent pendente";
const SOURCE = "backfill_migration";
const KEYS = ["marketing", "tracking"] as const;

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const [leads, contacts] = await Promise.all([
    prisma.lead.findMany({ select: { id: true } }),
    prisma.contact.findMany({ select: { id: true } }),
  ]);

  console.log(`→ ${leads.length} leads e ${contacts.length} contacts para backfill`);

  let inserted = 0;
  let skipped = 0;

  async function process(subjectType: "lead" | "contact", subjects: { id: string }[]) {
    for (const s of subjects) {
      for (const key of KEYS) {
        const existing = await prisma.consentLog.findFirst({
          where: {
            subjectType,
            subjectId: s.id,
            consentKey: key,
            source: SOURCE,
          },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await prisma.consentLog.create({
          data: {
            subjectType,
            subjectId: s.id,
            consentKey: key,
            granted: false,
            source: SOURCE,
            reason: REASON,
          },
        });
        inserted++;
      }
    }
  }

  await process("lead", leads);
  await process("contact", contacts);

  console.log(`✓ backfill concluído: inseridos=${inserted}, pulados=${skipped}`);
  console.log(`  esperado total: ${(leads.length + contacts.length) * 2} logs (após execução completa)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("✗ backfill FALHOU:", err);
  process.exit(1);
});
