/**
 * Parseia `PrismaClientKnownRequestError` P2002 (unique violation) para
 * extrair `{entity, key}` a partir do nome do índice partial nomeado
 * `idx_<entityPlural>_custom_<key>_unique` (ou versão truncada via T3.5
 * com sufixo `_<hash6>` e possível remoção do `_unique`).
 *
 * Retorna `null` se o erro não for P2002, se o index name não casar com
 * o padrão ou se a key derivada não for válida.
 */
export function parseP2002IndexName(
  err: unknown,
): { entity: "lead" | "contact" | "opportunity"; key: string } | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return null;

  const target = e.meta?.target;
  const name =
    typeof target === "string"
      ? target
      : Array.isArray(target) && typeof target[0] === "string"
        ? target[0]
        : null;
  if (!name) return null;

  // idx_<entityPlural>_custom_<key>  com opcionais _unique e/ou _<hash6>
  const match = name.match(
    /^idx_(leads|contacts|opportunities)_custom_(.+?)(?:_unique)?(?:_[a-f0-9]{6})?$/,
  );
  if (!match) return null;

  const entityPlural = match[1];
  const key = match[2];

  const entity: "lead" | "contact" | "opportunity" =
    entityPlural === "leads"
      ? "lead"
      : entityPlural === "contacts"
        ? "contact"
        : "opportunity";

  // Validação conservadora da key (coerência com schema)
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(key)) return null;

  return { entity, key };
}
