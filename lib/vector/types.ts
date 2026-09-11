/** Typdefinitionen für Vector DB und semantische Suche. */

export type VectorEntityType =
  | 'prompt'
  | 'message'
  | 'run'
  | 'step'
  | 'source'
  | 'excerpt'
  | 'conflict'
  | 'citation'
  | 'tool_call';

export interface VectorRecord {
  id: string;
  entityType: VectorEntityType;
  entityId: string;
  parentId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  embedding: Float32Array;
  dimensions: number;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface VectorInput {
  id?: string;
  entityType: VectorEntityType;
  entityId: string;
  parentId?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: Float32Array | number[];
  model?: string;
}

export interface VectorSearchQuery {
  query: string | Float32Array | number[];
  entityTypes?: VectorEntityType[];
  parentId?: string;
  limit?: number;
  minSimilarity?: number;
}

export interface VectorSearchResult {
  id: string;
  entityType: VectorEntityType;
  entityId: string;
  parentId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: string;
}

export interface VectorStoreStats {
  total: number;
  byType: Record<VectorEntityType, number>;
  dimensions: number;
  model: string;
  lastUpdatedAt: string | null;
}
