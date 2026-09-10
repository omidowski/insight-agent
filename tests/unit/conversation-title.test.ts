import { describe, expect, it } from 'vitest';
import { resolveConversationTitle } from '@/lib/agent/title';

describe('conversation title resolve', () => {
  it('uses model title when it is meaningful', () => {
    expect(resolveConversationTitle('Was ist ein Vektor-Embedding?', 'Vektor-Embeddings erklärt')).toBe(
      'Vektor-Embeddings erklärt',
    );
  });

  it('falls back when model returns empty or default Neuer Chat', () => {
    expect(resolveConversationTitle('Was ist ein Vektor-Embedding?', 'Neuer Chat')).toBe(
      'Was ist ein Vektor-Embedding?',
    );
    expect(resolveConversationTitle('Was ist ein Vektor-Embedding?', '  ')).toBe(
      'Was ist ein Vektor-Embedding?',
    );
  });

  it('truncates long fallbacks to 48 chars without cutting mid-word harshly', () => {
    const long = 'A'.repeat(80);
    expect(resolveConversationTitle(long, '').length).toBeLessThanOrEqual(48);
  });
});
