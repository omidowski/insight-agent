/** Citation-Nachbearbeitung und Verifikation (Spec 27). */
import type { Citation, ExcerptRecord, SourceRecord } from '@/lib/contracts/domain';

export interface CitationDraft {
  marker: number;
  sourceId: string;
  excerptId: string | null;
  claimText: string;
}

export interface CitationResult {
  text: string;
  citations: CitationDraft[];
  removedMarkers: number[];
  unsupported: string[];
}

const CODE_FENCE = /```[\s\S]*?```|`[^`\n]*`/g;

function codeRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const match of text.matchAll(CODE_FENCE)) {
    if (match.index === undefined) continue;
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function inCode(index: number, ranges: { start: number; end: number }[]): boolean {
  return ranges.some((r) => index >= r.start && index < r.end);
}

export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  const regex = /[^.!?\n]+[.!?]*/g;
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined) continue;
    const value = match[0];
    if (value.trim().length === 0) continue;
    out.push({ text: value.trim(), start: match.index, end: match.index + value.length });
  }
  return out;
}

function overlapScore(claim: string, excerpt: string): number {
  const terms = new Set(
    claim.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 3),
  );
  if (terms.size === 0) return 0;
  const lower = excerpt.toLowerCase();
  let hits = 0;
  for (const term of terms) if (lower.includes(term)) hits++;
  return hits / terms.size;
}

export function applyCitations(args: {
  answer: string;
  sources: SourceRecord[];
  excerpts: ExcerptRecord[];
  minExcerptMatch: number;
}): CitationResult {
  const byIndex = new Map(args.sources.map((s) => [s.indexNum, s]));
  const ranges = codeRanges(args.answer);
  const removedMarkers: number[] = [];

  // 1. Unbekannte Marker entfernen (außerhalb von Code)
  let text = '';
  let cursor = 0;
  for (const match of args.answer.matchAll(/\[(\d{1,3})\]/g)) {
    if (match.index === undefined) continue;
    const marker = Number(match[1]);
    text += args.answer.slice(cursor, match.index);
    if (inCode(match.index, ranges) || byIndex.has(marker)) {
      text += match[0];
    } else {
      removedMarkers.push(marker);
    }
    cursor = match.index + match[0].length;
  }
  text += args.answer.slice(cursor);
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,;:])/g, '$1');

  // 2. Citations je Satz sammeln
  const citations: CitationDraft[] = [];
  const cleanRanges = codeRanges(text);
  for (const sentence of splitSentences(text)) {
    const markers = Array.from(sentence.text.matchAll(/\[(\d{1,3})\]/g))
      .map((m) => Number(m[1]))
      .filter((m) => byIndex.has(m));
    if (markers.length === 0) continue;
    if (inCode(sentence.start, cleanRanges)) continue;
    const claimText = sentence.text.replace(/\[\d{1,3}\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
    for (const marker of Array.from(new Set(markers))) {
      const source = byIndex.get(marker) as SourceRecord;
      const candidates = args.excerpts.filter((e) => e.sourceId === source.id);
      let best: ExcerptRecord | undefined;
      let bestScore = args.minExcerptMatch;
      for (const excerpt of candidates) {
        const score = overlapScore(claimText, excerpt.text);
        if (score >= bestScore) { bestScore = score; best = excerpt; }
      }
      citations.push({
        marker,
        sourceId: source.id,
        excerptId: best?.id ?? null,
        claimText,
      });
    }
  }

  // 3. Faktische Aussagen ohne Beleg sammeln
  const META = /\b(quelle|quellen|recherche|ausgewertet|zusammengefasst|offene punkte|nicht belegt|budget)\b/i;
  const unsupported = splitSentences(text)
    .filter((s) => !/\[\d{1,3}\]/.test(s.text))
    .filter((s) => /\d/.test(s.text) && s.text.length > 40)
    .filter((s) => s.text.trim().split(/\s+/).length >= 6)
    .filter((s) => !META.test(s.text))
    .filter((s) => !/^[#>|\-*\d]/.test(s.text.trim()))
    .map((s) => s.text)
    .slice(0, 5);

  return { text, citations, removedMarkers, unsupported };
}

export function renderSourceList(sources: SourceRecord[], used: Set<number>): string {
  const relevant = sources
    .filter((s) => used.has(s.indexNum))
    .sort((a, b) => a.indexNum - b.indexNum);
  if (relevant.length === 0) return '';
  const lines = relevant.map((s) => {
    const date = s.publishedAt ? ` · ${s.publishedAt.slice(0, 10)}` : ' · Datum unbekannt';
    const weak = s.status !== 'fetched' ? ' · nur Suchergebnis' : '';
    return `${s.indexNum}. [${s.title.replace(/[[\]]/g, '')}](${s.url}) — ${s.domain}${date}${weak}`;
  });
  return `\n\n## Quellen\n\n${lines.join('\n')}`;
}

export function toCitationRows(
  drafts: CitationDraft[],
  messageId: string,
  runId: string,
): Omit<Citation, 'id' | 'createdAt'>[] {
  return drafts.map((d) => ({
    messageId,
    runId,
    sourceId: d.sourceId,
    excerptId: d.excerptId,
    marker: d.marker,
    claimText: d.claimText,
  }));
}
