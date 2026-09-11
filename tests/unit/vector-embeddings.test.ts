import { describe, expect, it } from 'vitest';
import { DeterministicEmbeddingProvider } from '@/lib/vector/embeddings';
import { cosineSimilarity, l2Norm } from '@/lib/vector/math';

describe('Vector Embeddings (Deterministic)', () => {
  const provider = new DeterministicEmbeddingProvider(256, 'deterministic-v1');

  it('erzeugt normalisierte Vektoren fester Dimension', async () => {
    const vec = await provider.embed('Recherche über autonome Agenten');
    expect(vec.length).toBe(256);
    expect(l2Norm(vec)).toBeCloseTo(1.0, 4);
  });

  it('ist vollständig deterministisch für gleichen Text', async () => {
    const vec1 = await provider.embed('Insight Agent Source of Truth');
    const vec2 = await provider.embed('Insight Agent Source of Truth');

    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 5);
  });

  it('liefert höhere Ähnlichkeit für semantisch verwandte Texte als für unzusammenhängende', async () => {
    const query = await provider.embed('Recherche über den FC Bayern München und Fußballstatistiken');
    const related = await provider.embed('Statistiken der Fußballspieler beim FC Bayern München');
    const unrelated = await provider.embed('Quantum computing algorithms in semiconductor design');

    const simRelated = cosineSimilarity(query, related);
    const simUnrelated = cosineSimilarity(query, unrelated);

    expect(simRelated).toBeGreaterThan(0.4);
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it('verarbeitet Batch-Anfragen korrekt', async () => {
    const texts = ['Text Eins', 'Text Zwei', 'Text Drei'];
    const results = await provider.embedBatch(texts);

    expect(results).toHaveLength(3);
    expect(results[0]?.length).toBe(256);
    expect(results[1]?.length).toBe(256);
  });
});
