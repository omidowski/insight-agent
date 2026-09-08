/** Quellentyp und Trust-Score (Spec 26, FR-26-04/05). */
import type { SourceType } from '@/lib/contracts/domain';

const SOCIAL = /(twitter|x\.com|facebook|instagram|tiktok|reddit|threads|linkedin)/i;
const AGGREGATOR = /(wikipedia|wikiwand|transfermarkt|statista|sportdaten|fandom|quora|pinterest)/i;
const NEWS = /(spiegel|zeit|faz|sueddeutsche|welt|kicker|bbc|guardian|reuters|nytimes|handelsblatt|heise|tagesschau|bundesliga|footballmoney)/i;
const OFFICIAL_TLD = /\.(gov|edu|org|int)$/i;
const OFFICIAL_HINT = /(fcbayern|uefa|fifa|dfb|europa\.eu|destatis|bundesbank|who|oecd|eurostat)/i;
const BLOG = /(medium\.com|blogspot|wordpress\.com|substack|tumblr)/i;

export function classifySource(domain: string): SourceType {
  if (SOCIAL.test(domain)) return 'social';
  if (OFFICIAL_TLD.test(domain) || OFFICIAL_HINT.test(domain)) return 'primary';
  if (AGGREGATOR.test(domain)) return 'aggregator';
  if (NEWS.test(domain)) return 'secondary';
  if (BLOG.test(domain)) return 'aggregator';
  return 'unknown';
}

const TYPE_SCORE: Record<SourceType, number> = {
  primary: 1, secondary: 0.7, aggregator: 0.5, social: 0.25, unknown: 0.4,
};

export function recencyScore(publishedAt: string | null, now = Date.now()): number {
  if (!publishedAt) return 0.3;
  const ts = new Date(publishedAt).getTime();
  if (Number.isNaN(ts)) return 0.3;
  const days = (now - ts) / 86_400_000;
  if (days <= 90) return 1;
  if (days <= 365) return 0.8;
  if (days <= 1095) return 0.5;
  return 0.3;
}

export function reputationScore(domain: string): number {
  if (OFFICIAL_HINT.test(domain)) return 0.9;
  if (OFFICIAL_TLD.test(domain)) return 0.8;
  if (NEWS.test(domain)) return 0.75;
  if (BLOG.test(domain)) return 0.4;
  if (AGGREGATOR.test(domain)) return 0.65;
  return 0.6;
}

export interface TrustInput {
  domain: string;
  sourceType: SourceType;
  publishedAt: string | null;
  /** Anteil bestätigter Werte (0..1). */
  agreement: number;
}

export function trustScoreFor(input: TrustInput): number {
  const score =
    0.35 * (TYPE_SCORE[input.sourceType] ?? 0.4) +
    0.25 * recencyScore(input.publishedAt) +
    0.25 * reputationScore(input.domain) +
    0.15 * Math.min(1, Math.max(0, input.agreement));
  return Math.round(score * 1000) / 1000;
}
