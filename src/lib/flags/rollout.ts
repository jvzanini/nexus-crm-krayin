/**
 * Hash determinístico fnv1a 32-bit → percentil 0..99.
 * Mesma `(key, userId)` sempre cai no mesmo bucket → rollout consistente.
 */
export function bucketOf(key: string, subjectId: string): number {
  const input = `${key}:${subjectId}`;
  let h = 0x811c9dc5; // fnv offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

/** Retorna true se o subjectId está dentro do rolloutPct (0..100). */
export function inRollout(
  key: string,
  subjectId: string,
  rolloutPct: number,
): boolean {
  if (rolloutPct <= 0) return false;
  if (rolloutPct >= 100) return true;
  return bucketOf(key, subjectId) < rolloutPct;
}
