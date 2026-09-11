/** Mathematische Hilfsfunktionen für Vektoren und Kosinus-Ähnlichkeit. */

export function floatsToBlob(floats: Float32Array | number[]): Buffer {
  const arr = floats instanceof Float32Array ? floats : new Float32Array(floats);
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function blobToFloats(buf: Buffer | Uint8Array): Float32Array {
  // Erzeugt ein ausgerichtetes Float32Array aus dem Buffer
  const byteOffset = buf.byteOffset;
  const byteLength = buf.byteLength;
  // Falls die Ausrichtung (Offset durch 4 teilbar) nicht passt, kopieren
  if (byteOffset % 4 !== 0) {
    const copy = new Uint8Array(byteLength);
    copy.set(buf);
    return new Float32Array(copy.buffer, 0, Math.floor(byteLength / 4));
  }
  return new Float32Array(buf.buffer, byteOffset, Math.floor(byteLength / 4));
}

export function dotProduct(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

export function l2Norm(a: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * a[i]!;
  }
  return Math.sqrt(sum);
}

export function normalize(v: Float32Array): Float32Array {
  const norm = l2Norm(v);
  if (norm === 0 || !Number.isFinite(norm)) return v;
  const out = new Float32Array(v.length);
  const inv = 1 / norm;
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i]! * inv;
  }
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0) return 0;
  const dot = dotProduct(a, b);
  const normA = l2Norm(a);
  const normB = l2Norm(b);
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (normA * normB);
  if (!Number.isFinite(sim)) return 0;
  return Math.max(-1, Math.min(1, sim));
}
