/** Token-Schätzung ohne Netzwerkzugriff (Spec 33, FR-33-06). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil((text.length / 3.7) * 1.1);
}

export function truncateToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  if (estimateTokens(text) <= maxTokens) return { text, truncated: false };
  const maxChars = Math.max(0, Math.floor((maxTokens / 1.1) * 3.7));
  const cut = text.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '));
  const safe = lastBreak > maxChars * 0.5 ? cut.slice(0, lastBreak + 1) : cut;
  return { text: `${safe}\n\n[…gekürzt]`, truncated: true };
}

/** Absätze nach Begriffsüberdeckung mit der Frage priorisieren (Spec 33, FR-33-03). */
export function relevantExcerptText(text: string, query: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const terms = new Set(
    query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 3),
  );
  const paragraphs = text.split(/\n{2,}/);
  const scored = paragraphs.map((p, index) => {
    const lower = p.toLowerCase();
    let score = 0;
    for (const t of terms) if (lower.includes(t)) score++;
    return { p, index, score };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  const picked: { p: string; index: number }[] = [];
  let total = 0;
  for (const item of scored) {
    if (total + item.p.length > maxChars) continue;
    picked.push(item);
    total += item.p.length + 2;
    if (total >= maxChars * 0.95) break;
  }
  if (picked.length === 0) return text.slice(0, maxChars);
  picked.sort((a, b) => a.index - b.index);
  return picked.map((x) => x.p).join('\n\n');
}
