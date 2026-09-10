/** Query diversity helpers — reject exact and near-duplicate search queries (Spec 25 FR-25-02). */

export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(query: string): Set<string> {
  return new Set(
    normalizeQuery(query)
      .split(' ')
      .filter((t) => t.length >= 2),
  );
}

/** High Jaccard overlap or strong containment of the smaller token set counts as near-duplicate. */
export function nearDuplicateQuery(a: string, b: string, threshold = 0.75): boolean {
  const na = normalizeQuery(a);
  const nb = normalizeQuery(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  if (union > 0 && inter / union >= threshold) return true;
  const smaller = Math.min(ta.size, tb.size);
  return smaller >= 2 && inter / smaller >= 0.8;
}

/**
 * Keep novel queries only: drop short noise, exact previous hits, and near-duplicates
 * vs previous set and vs siblings already accepted in this batch.
 */
export function diversifyQueries(
  candidates: string[],
  previous: ReadonlySet<string>,
  max: number,
): string[] {
  const previousNorm = new Set(
    Array.from(previous).map((q) => normalizeQuery(q)).filter(Boolean),
  );
  const accepted: string[] = [];
  for (const raw of candidates) {
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 2) continue;
    const norm = normalizeQuery(cleaned);
    if (!norm) continue;
    if (previousNorm.has(norm)) continue;
    if (Array.from(previous).some((p) => nearDuplicateQuery(cleaned, p))) continue;
    if (accepted.some((a) => nearDuplicateQuery(cleaned, a))) continue;
    accepted.push(cleaned);
    previousNorm.add(norm);
    if (accepted.length >= max) break;
  }
  return accepted;
}
