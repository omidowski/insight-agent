import { describe, expect, it } from 'vitest';
import {
  blobToFloats,
  cosineSimilarity,
  dotProduct,
  floatsToBlob,
  l2Norm,
  normalize,
} from '@/lib/vector/math';

describe('Vector Math', () => {
  it('konvertiert Float32Array verlustfrei in Buffer und zurück', () => {
    const original = new Float32Array([0.1, -0.5, 0.999, 12.345]);
    const blob = floatsToBlob(original);
    const restored = blobToFloats(blob);

    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!, 5);
    }
  });

  it('berechnet das Skalarprodukt (Dot Product)', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    expect(dotProduct(a, b)).toBe(1 * 4 + 2 * 5 + 3 * 6); // 32
  });

  it('berechnet die L2-Norm und normalisiert Vektoren auf Länge 1', () => {
    const v = new Float32Array([3, 4]); // 3^2 + 4^2 = 25 -> sqrt = 5
    expect(l2Norm(v)).toBeCloseTo(5, 5);

    const norm = normalize(v);
    expect(norm[0]).toBeCloseTo(0.6, 5);
    expect(norm[1]).toBeCloseTo(0.8, 5);
    expect(l2Norm(norm)).toBeCloseTo(1, 5);
  });

  it('berechnet Kosinus-Ähnlichkeit korrekt', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    const c = new Float32Array([0, 1, 0]);
    const d = new Float32Array([-1, 0, 0]);

    // Identische Vektoren -> 1.0
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);

    // Orthogonale Vektoren -> 0.0
    expect(cosineSimilarity(a, c)).toBeCloseTo(0.0, 5);

    // Entgegengesetzte Vektoren -> -1.0
    expect(cosineSimilarity(a, d)).toBeCloseTo(-1.0, 5);
  });

  it('behandelt Nullvektoren robust ohne NaN', () => {
    const zero = new Float32Array([0, 0, 0]);
    const a = new Float32Array([1, 2, 3]);

    expect(cosineSimilarity(zero, a)).toBe(0);
    expect(cosineSimilarity(zero, zero)).toBe(0);
  });
});
