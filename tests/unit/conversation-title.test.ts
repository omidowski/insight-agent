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

  it('strips enclosing quotes and title prefixes from model title', () => {
    expect(resolveConversationTitle('Recherche Musiala', '"Musiala Saison 25/26"')).toBe('Musiala Saison 25/26');
    expect(resolveConversationTitle('Recherche Musiala', 'Titel: Musiala Statistiken')).toBe('Musiala Statistiken');
    expect(resolveConversationTitle('Recherche Musiala', 'Title: Musiala Overview')).toBe('Musiala Overview');
  });

  it('recognizes placeholder variants with quotes or punctuation', () => {
    expect(resolveConversationTitle('Was ist RAG?', '"Neuer Chat"')).toBe('Was ist RAG?');
    expect(resolveConversationTitle('Was ist RAG?', 'Neuer Chat.')).toBe('Was ist RAG?');
    expect(resolveConversationTitle('Was ist RAG?', 'New Chat')).toBe('Was ist RAG?');
    expect(resolveConversationTitle('Was ist RAG?', 'Untitled')).toBe('Was ist RAG?');
    expect(resolveConversationTitle('Was ist RAG?', 'Ohne Titel')).toBe('Was ist RAG?');
  });

  it('truncates long fallbacks to 48 chars without cutting mid-word harshly', () => {
    const long = 'A'.repeat(80);
    expect(resolveConversationTitle(long, '').length).toBeLessThanOrEqual(48);
  });
});
