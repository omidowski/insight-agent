/**
 * Zugriff auf das eingebaute node:sqlite ohne statische Modulreferenz.
 * Bundler (webpack in Next.js, Vite in Vitest) kennen `node:sqlite` noch nicht als Builtin und
 * würden es aufzulösen versuchen. `process.getBuiltinModule` umgeht jede Bundler-Analyse (ADR-002).
 */
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

interface SqliteModule {
  DatabaseSync: typeof DatabaseSyncType;
}

function loadSqlite(): SqliteModule {
  const getBuiltin = (process as unknown as {
    getBuiltinModule?: (id: string) => SqliteModule | undefined;
  }).getBuiltinModule;
  const loaded = typeof getBuiltin === 'function' ? getBuiltin('node:sqlite') : undefined;
  if (!loaded?.DatabaseSync) {
    throw new Error(
      'node:sqlite ist nicht verfügbar. Node.js 22.5+ wird benötigt (siehe ADR-002).',
    );
  }
  return loaded;
}

export const DatabaseSync = loadSqlite().DatabaseSync;
export type Database = DatabaseSyncType;
