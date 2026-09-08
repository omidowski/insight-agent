/** Wertnormalisierung für den Quellenvergleich (Spec 28, FR-28-01). */

export interface NormalizedValue {
  kind: 'number' | 'text';
  number?: number;
  unit?: string;
  currency?: string;
  percent?: boolean;
  text: string;
}

const MULTIPLIERS: Record<string, number> = {
  tsd: 1e3, k: 1e3, tausend: 1e3,
  mio: 1e6, mill: 1e6, million: 1e6, millionen: 1e6, m: 1e6,
  mrd: 1e9, milliarde: 1e9, milliarden: 1e9, bn: 1e9, billion: 1e9, b: 1e9,
};

const CURRENCIES: Record<string, string> = {
  '€': 'EUR', eur: 'EUR', euro: 'EUR',
  $: 'USD', usd: 'USD', dollar: 'USD',
  '£': 'GBP', gbp: 'GBP',
};

function parseNumeric(raw: string): number | undefined {
  const cleaned = raw.replace(/\s/g, '');
  // 1.234,56 (de) vs 1,234.56 (en)
  const de = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned);
  const en = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned);
  let normalized = cleaned;
  if (de) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (en) normalized = cleaned.replace(/,/g, '');
  else normalized = cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeValue(input: string): NormalizedValue {
  const text = input.trim();
  const lower = text.toLowerCase();

  let currency: string | undefined;
  for (const [token, code] of Object.entries(CURRENCIES)) {
    if (lower.includes(token)) { currency = code; break; }
  }
  const percent = /%|prozent/.test(lower);

  const match = /(-?[\d.,]+)\s*([a-zäöü.]*)/i.exec(lower);
  if (match) {
    const numeric = parseNumeric(match[1] as string);
    if (numeric !== undefined) {
      const suffix = (match[2] ?? '').replace(/\./g, '');
      const multiplier = MULTIPLIERS[suffix] ?? 1;
      const value = numeric * multiplier;
      const result: NormalizedValue = { kind: 'number', number: value, text };
      if (currency) result.currency = currency;
      if (percent) result.percent = true;
      const unit = /\b(tore|assists|spiele|minuten|punkte|jahre|mio|mrd)\b/.exec(lower)?.[1];
      if (unit && !MULTIPLIERS[unit]) result.unit = unit;
      return result;
    }
  }
  return { kind: 'text', text: text.toLowerCase().replace(/\s+/g, ' ') };
}

export interface Comparison {
  equal: boolean;
  reason: 'numeric_match' | 'numeric_mismatch' | 'currency_mismatch' | 'text_match' | 'text_mismatch';
}

export function compareValues(a: string, b: string, tolerance = 0.01): Comparison {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na.kind === 'number' && nb.kind === 'number') {
    if (na.currency && nb.currency && na.currency !== nb.currency) {
      return { equal: false, reason: 'currency_mismatch' };
    }
    const x = na.number as number;
    const y = nb.number as number;
    if (x === y) return { equal: true, reason: 'numeric_match' };
    const denom = Math.max(Math.abs(x), Math.abs(y));
    if (denom === 0) return { equal: true, reason: 'numeric_match' };
    const diff = Math.abs(x - y) / denom;
    return diff <= tolerance
      ? { equal: true, reason: 'numeric_match' }
      : { equal: false, reason: 'numeric_mismatch' };
  }
  return na.text === nb.text
    ? { equal: true, reason: 'text_match' }
    : { equal: false, reason: 'text_mismatch' };
}

/** Erkennt Zeitraumangaben in claimKey oder Text (Spec 28, FR-28-05). */
export function periodOf(text: string): string | undefined {
  const season = /\b(20\d{2})[/_-](\d{2})\b/.exec(text);
  if (season) return `${season[1]}/${season[2]}`;
  const year = /\b(19|20)\d{2}\b/.exec(text);
  return year ? year[0] : undefined;
}
