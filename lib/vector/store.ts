/** SQLite-gestützter Vektorspeicher mit Kosinus-Ähnlichkeitssuche. */
import type { Db } from '@/lib/db/client';
import { getDb, plain, plainAll } from '@/lib/db/client';
import { newId, type IdPrefix } from '@/lib/util/id';
import { nowIso } from '@/lib/util/time';
import { blobToFloats, cosineSimilarity, floatsToBlob, normalize } from './math';
import type { EmbeddingProvider } from './embeddings';
import { getEmbeddingProvider } from './embeddings';
import type {
  VectorEntityType,
  VectorInput,
  VectorRecord,
  VectorSearchQuery,
  VectorSearchResult,
  VectorStoreStats,
} from './types';

interface RawVectorRow {
  id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  content: string;
  metadata_json: string;
  embedding: Buffer | Uint8Array;
  dimensions: number;
  model: string;
  created_at: string;
  updated_at: string;
}

export class VectorStore {
  private db: Db;
  private provider: EmbeddingProvider;

  constructor(db: Db, provider?: EmbeddingProvider) {
    this.db = db;
    this.provider = provider ?? getEmbeddingProvider();
  }

  get embeddingProvider(): EmbeddingProvider {
    return this.provider;
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.provider = provider;
  }

  private mapRow(r: RawVectorRow): VectorRecord {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(r.metadata_json) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
    return {
      id: r.id,
      entityType: r.entity_type as VectorEntityType,
      entityId: r.entity_id,
      parentId: r.parent_id,
      content: r.content,
      metadata,
      embedding: blobToFloats(r.embedding),
      dimensions: Number(r.dimensions),
      model: r.model,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async upsert(input: VectorInput): Promise<VectorRecord> {
    const [record] = await this.upsertBatch([input]);
    return record!;
  }

  async upsertBatch(inputs: VectorInput[]): Promise<VectorRecord[]> {
    if (inputs.length === 0) return [];

    // Finde Inputs ohne Embedding und berechne sie gebündelt
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i]!;
      if (!inp.embedding) {
        missingIndices.push(i);
        missingTexts.push(inp.content);
      }
    }

    let calculatedEmbeddings: Float32Array[] = [];
    if (missingTexts.length > 0) {
      calculatedEmbeddings = await this.provider.embedBatch(missingTexts);
    }

    const embeddingsMap = new Map<number, Float32Array>();
    for (let k = 0; k < missingIndices.length; k++) {
      embeddingsMap.set(missingIndices[k]!, calculatedEmbeddings[k]!);
    }

    const ts = nowIso();
    const records: VectorRecord[] = [];

    const stmt = this.db.prepare(`
      INSERT INTO vector_entries (
        id, entity_type, entity_id, parent_id, content, metadata_json,
        embedding, dimensions, model, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        content = excluded.content,
        metadata_json = excluded.metadata_json,
        embedding = excluded.embedding,
        dimensions = excluded.dimensions,
        model = excluded.model,
        updated_at = excluded.updated_at
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i]!;
        const rawEmb = inp.embedding
          ? (inp.embedding instanceof Float32Array ? inp.embedding : new Float32Array(inp.embedding))
          : embeddingsMap.get(i)!;
        const normEmb = normalize(rawEmb);
        const id = inp.id ?? newId('vec' as IdPrefix);
        const metadataJson = JSON.stringify(inp.metadata ?? {});
        const model = inp.model ?? this.provider.model;
        const dimensions = normEmb.length;
        const blob = floatsToBlob(normEmb);

        stmt.run(
          id,
          inp.entityType,
          inp.entityId,
          inp.parentId ?? null,
          inp.content,
          metadataJson,
          blob,
          dimensions,
          model,
          ts,
          ts,
        );

        records.push({
          id,
          entityType: inp.entityType,
          entityId: inp.entityId,
          parentId: inp.parentId ?? null,
          content: inp.content,
          metadata: inp.metadata ?? {},
          embedding: normEmb,
          dimensions,
          model,
          createdAt: ts,
          updatedAt: ts,
        });
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return records;
  }

  get(id: string): VectorRecord | undefined {
    const row = this.db.prepare('SELECT * FROM vector_entries WHERE id = ?').get(id);
    if (!row) return undefined;
    return this.mapRow(plain<RawVectorRow>(row));
  }

  getByEntity(entityType: VectorEntityType, entityId: string): VectorRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM vector_entries WHERE entity_type = ? AND entity_id = ?')
      .get(entityType, entityId);
    if (!row) return undefined;
    return this.mapRow(plain<RawVectorRow>(row));
  }

  delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM vector_entries WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  deleteByEntity(entityType: VectorEntityType, entityId: string): boolean {
    const res = this.db
      .prepare('DELETE FROM vector_entries WHERE entity_type = ? AND entity_id = ?')
      .run(entityType, entityId);
    return Number(res.changes) > 0;
  }

  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    let queryVector: Float32Array;
    if (typeof query.query === 'string') {
      queryVector = normalize(await this.provider.embed(query.query));
    } else if (query.query instanceof Float32Array) {
      queryVector = normalize(query.query);
    } else {
      queryVector = normalize(new Float32Array(query.query));
    }

    const whereClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (query.entityTypes && query.entityTypes.length > 0) {
      const placeholders = query.entityTypes.map(() => '?').join(', ');
      whereClauses.push(`entity_type IN (${placeholders})`);
      params.push(...query.entityTypes);
    }

    if (query.parentId) {
      whereClauses.push('parent_id = ?');
      params.push(query.parentId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT id, entity_type, entity_id, parent_id, content, metadata_json, embedding, created_at FROM vector_entries ${whereSql}`;
    const rows = (this.db.prepare(sql) as { all: (...args: unknown[]) => unknown[] }).all(...params);
    const minSimilarity = query.minSimilarity ?? 0.0;
    const limit = query.limit ?? 10;

    const scored: VectorSearchResult[] = [];

    for (const raw of rows) {
      const r = plain<RawVectorRow>(raw);
      const vec = blobToFloats(r.embedding);
      const similarity = cosineSimilarity(queryVector, vec);

      if (similarity >= minSimilarity) {
        let metadata: Record<string, unknown> = {};
        try {
          metadata = JSON.parse(r.metadata_json) as Record<string, unknown>;
        } catch {
          metadata = {};
        }

        scored.push({
          id: r.id,
          entityType: r.entity_type as VectorEntityType,
          entityId: r.entity_id,
          parentId: r.parent_id,
          content: r.content,
          metadata,
          similarity,
          createdAt: r.created_at,
        });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  count(entityType?: VectorEntityType): number {
    if (entityType) {
      const r = this.db
        .prepare('SELECT COUNT(*) AS n FROM vector_entries WHERE entity_type = ?')
        .get(entityType);
      return Number(plain<{ n: number }>(r).n);
    }
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM vector_entries').get();
    return Number(plain<{ n: number }>(r).n);
  }

  stats(): VectorStoreStats {
    const total = this.count();
    const rows = this.db
      .prepare('SELECT entity_type, COUNT(*) AS count FROM vector_entries GROUP BY entity_type')
      .all();

    const byType: Record<VectorEntityType, number> = {
      prompt: 0,
      message: 0,
      run: 0,
      step: 0,
      source: 0,
      excerpt: 0,
      conflict: 0,
      citation: 0,
      tool_call: 0,
    };

    for (const row of plainAll<{ entity_type: string; count: number }>(rows)) {
      if (row.entity_type in byType) {
        byType[row.entity_type as VectorEntityType] = Number(row.count);
      }
    }

    const latest = this.db
      .prepare('SELECT updated_at FROM vector_entries ORDER BY updated_at DESC LIMIT 1')
      .get();
    const lastUpdatedAt = latest ? plain<{ updated_at: string }>(latest).updated_at : null;

    return {
      total,
      byType,
      dimensions: this.provider.dimension,
      model: this.provider.model,
      lastUpdatedAt,
    };
  }

  clear(): void {
    this.db.exec('DELETE FROM vector_entries');
  }
}

let defaultStore: VectorStore | undefined;

export function getVectorStore(db?: Db, provider?: EmbeddingProvider): VectorStore {
  if (db) return new VectorStore(db, provider);
  if (!defaultStore) {
    defaultStore = new VectorStore(getDb(), provider);
  }
  return defaultStore;
}

export function resetVectorStore(): void {
  defaultStore = undefined;
}
