import { createHash } from "crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Entity } from "./types";

/** SHA-256 hex do buffer. */
export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export interface FindDuplicateArgs {
  prisma: PrismaClient;
  companyId: string;
  entity: Entity;
  fileHash: string;
}

/**
 * Procura um `DataTransferJob` de import com o mesmo `fileHash` para
 * o mesmo tenant+entity nas últimas 24h (excluindo jobs `failed`).
 * Retorna o job encontrado ou `null`.
 */
export async function findDuplicate(
  args: FindDuplicateArgs,
): Promise<unknown | null> {
  const { prisma, companyId, entity, fileHash } = args;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.dataTransferJob.findFirst({
    where: {
      companyId,
      entity,
      fileHash,
      direction: "import",
      status: { not: "failed" },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });
}
