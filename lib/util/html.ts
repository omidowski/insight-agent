/** HTML-Extraktion: Fließtext, Tabellen, Metadaten (Spec 20, FR-20-05/06). */
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

export interface ExtractedPage {
  title: string;
  author: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
  text: string;
  textLength: number;
  truncated: boolean;
  contentHash: string;
  paywalled: boolean;
}

const MAX_TEXT = 40_000;
const NOISE = 'script, style, noscript, iframe, svg, nav, footer, header, aside, form, button, [role=banner], [role=navigation], [aria-hidden=true], .ad, .ads, .advert, .cookie, .newsletter, .sidebar';

function cleanText(value: string): string {
  return value.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function isoDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  const de = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(trimmed);
  if (de) {
    const parsed = new Date(Number(de[3]), Number(de[2]) - 1, Number(de[1]));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

export function extractContent(html: string, sourceUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const canonicalUrl = $('link[rel="canonical"]').attr('href') ?? null;
  const title = cleanText(
    $('meta[property="og:title"]').attr('content') ??
      $('title').first().text() ??
      $('h1').first().text() ??
      new URL(sourceUrl, 'https://unknown.invalid').hostname,
  ).slice(0, 300);

  let author =
    $('meta[name="author"]').attr('content') ??
    $('meta[property="article:author"]').attr('content') ??
    null;

  let publishedAt =
    isoDate($('meta[property="article:published_time"]').attr('content')) ??
    isoDate($('meta[name="date"]').attr('content')) ??
    isoDate($('time[datetime]').first().attr('datetime')) ??
    null;

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      const data = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (!publishedAt && typeof entry.datePublished === 'string') {
          publishedAt = isoDate(entry.datePublished);
        }
        if (!author && typeof entry.author === 'string') author = entry.author;
        if (!author && entry.author && typeof entry.author === 'object') {
          const a = entry.author as { name?: string };
          if (typeof a.name === 'string') author = a.name;
        }
      }
    } catch {
      /* fehlerhaftes JSON-LD ignorieren */
    }
  });

  const bodyText = $('body').text();
  const paywalled = /paywall|abo abschließen|jetzt freischalten|subscribe to continue|nur für abonnenten/i.test(bodyText);

  $(NOISE).remove();

  const candidates = ['article', '[role=main]', 'main', '#content', '.content', 'body'];
  let container: cheerio.Cheerio<never> = $('body') as unknown as cheerio.Cheerio<never>;
  let best = 0;
  for (const selector of candidates) {
    const node = $(selector).first();
    if (node.length === 0) continue;
    const length = cleanText(node.text()).length;
    const density = length / Math.max(1, node.find('*').length);
    const score = length * (selector === 'body' ? 0.5 : 1) + density * 10;
    if (score > best) {
      best = score;
      container = node as unknown as cheerio.Cheerio<never>;
    }
  }

  const parts: string[] = [];
  ($(container) as cheerio.Cheerio<never>).find('h1, h2, h3, h4, p, li, blockquote, table, pre').each((_i: number, el: unknown) => {
    const node = $(el as never);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
    if (tag === 'table') {
      const rows: string[] = [];
      node.find('tr').each((_r, tr) => {
        const cells: string[] = [];
        $(tr).find('th, td').each((_c, cell) => {
          cells.push(cleanText($(cell).text()));
        });
        if (cells.length > 0) rows.push(`| ${cells.join(' | ')} |`);
      });
      if (rows.length > 1) {
        const columns = (rows[0]?.split('|').length ?? 3) - 2;
        rows.splice(1, 0, `|${' --- |'.repeat(Math.max(1, columns))}`);
        parts.push(rows.join('\n'));
      }
      return;
    }
    if (node.parents('table').length > 0) return;
    const text = cleanText(node.text());
    if (text.length < 2) return;
    if (tag.startsWith('h')) parts.push(`${'#'.repeat(Number(tag.slice(1)) || 2)} ${text}`);
    else if (tag === 'li') parts.push(`- ${text}`);
    else parts.push(text);
  });

  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  const full = unique.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  const truncated = full.length > MAX_TEXT;
  const text = truncated ? full.slice(0, MAX_TEXT) : full;

  return {
    title,
    author: author ? cleanText(author).slice(0, 160) : null,
    publishedAt,
    canonicalUrl,
    text,
    textLength: full.length,
    truncated,
    contentHash: createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ')).digest('hex'),
    paywalled,
  };
}

export interface PageMatch { text: string; startOffset: number; endOffset: number }

/** Volltextsuche mit Kontextfenster (Spec 20, FR-20-08). */
export function searchInText(text: string, query: string, context = 200, limit = 5): PageMatch[] {
  const matches: PageMatch[] = [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return matches;
  let from = 0;
  while (matches.length < limit) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    const start = Math.max(0, index - context);
    const end = Math.min(text.length, index + needle.length + context);
    matches.push({ text: text.slice(start, end), startOffset: start, endOffset: end });
    from = index + needle.length;
  }
  return matches;
}

/** Findet ein Excerpt im Originaltext (exakt, sonst whitespace-tolerant) — Spec 24, FR-24-04. */
export function locateExcerpt(text: string, excerpt: string): { startOffset: number; endOffset: number } | undefined {
  const trimmed = excerpt.trim();
  if (trimmed.length < 10) return undefined;
  const direct = text.indexOf(trimmed);
  if (direct !== -1) return { startOffset: direct, endOffset: direct + trimmed.length };

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const normalizedText = normalize(text);
  const normalizedExcerpt = normalize(trimmed);
  const index = normalizedText.indexOf(normalizedExcerpt);
  if (index === -1) return undefined;

  // Position im Originaltext zurückrechnen
  let originalIndex = 0;
  let normalizedIndex = 0;
  while (normalizedIndex < index && originalIndex < text.length) {
    const char = text[originalIndex] as string;
    if (/\s/.test(char)) {
      if (originalIndex === 0 || !/\s/.test(text[originalIndex - 1] as string)) normalizedIndex++;
    } else {
      normalizedIndex++;
    }
    originalIndex++;
  }
  return { startOffset: originalIndex, endOffset: Math.min(text.length, originalIndex + trimmed.length) };
}
