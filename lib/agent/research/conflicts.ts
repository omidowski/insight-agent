/** Widerspruchserkennung zwischen Quellen (Spec 28). */
import type { ConflictEntry, ExtractionItem, SourceRecord } from '@/lib/contracts/domain';
import { compareValues, periodOf } from '@/lib/util/values';

export interface DetectedConflict {
  claimKey: string;
  description: string;
  entries: ConflictEntry[];
}

export interface ComparisonSummary {
  comparedCount: number;
  agreementCount: number;
  conflicts: DetectedConflict[];
  agreementBySource: Map<string, number>;
}

export function detectConflicts(
  items: ExtractionItem[],
  sources: SourceRecord[],
  tolerance: number,
): ComparisonSummary {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const groups = new Map<string, ExtractionItem[]>();
  for (const item of items) {
    if (!item.sourceId) continue;
    const period = periodOf(`${item.claimKey} ${item.excerpt}`) ?? '';
    const key = `${item.claimKey}|${period}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const conflicts: DetectedConflict[] = [];
  const agreementBySource = new Map<string, number>();
  let comparedCount = 0;
  let agreementCount = 0;

  for (const [key, group] of groups) {
    const distinctSources = new Set(group.map((g) => g.sourceId));
    if (distinctSources.size < 2) continue;
    comparedCount++;

    const buckets: { value: string; items: ExtractionItem[] }[] = [];
    for (const item of group) {
      const bucket = buckets.find((b) => compareValues(b.value, item.value, tolerance).equal);
      if (bucket) bucket.items.push(item);
      else buckets.push({ value: item.value, items: [item] });
    }

    if (buckets.length <= 1) {
      agreementCount++;
      for (const item of group) {
        if (item.sourceId) {
          agreementBySource.set(item.sourceId, (agreementBySource.get(item.sourceId) ?? 0) + 1);
        }
      }
      continue;
    }

    const entries: ConflictEntry[] = [];
    for (const bucket of buckets) {
      const item = bucket.items[0] as ExtractionItem;
      const source = item.sourceId ? byId.get(item.sourceId) : undefined;
      if (!source) continue;
      entries.push({
        sourceId: source.id,
        index: source.indexNum,
        value: item.value,
        trustScore: source.trustScore,
      });
    }
    if (entries.length < 2) continue;
    entries.sort((a, b) => b.trustScore - a.trustScore);
    const claimKey = key.split('|')[0] as string;
    const label = (group[0] as ExtractionItem).label;
    conflicts.push({
      claimKey,
      description: `${label}: ${entries.map((e) => `${e.value} [${e.index}]`).join(' bzw. ')}`,
      entries,
    });
  }

  return { comparedCount, agreementCount, conflicts, agreementBySource };
}
