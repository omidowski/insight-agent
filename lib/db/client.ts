/** SQLite-Zugriff über node:sqlite mit Migrationen (Spec 04, ADR-002/ADR-009). */
import { DatabaseSync, type Database } from './sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MIGRATIONS } from './migrations';
import { nowIso } from '@/lib/util/time';
import { logger } from '@/lib/util/logger';

export type Db = Database;

let instance: Db | undefined;
let instancePath: string | undefined;

export function openDatabase(path: string): Db {
  if (path !== ':memory:') {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      /* Verzeichnis existiert bereits */
    }
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

export function migrate(db: Db): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name),
  );
  const run: string[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        nowIso(),
      );
      db.exec('COMMIT');
      run.push(migration.name);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  if (run.length > 0) logger.info('migrations applied', { module: 'db', migrations: run });
  return run;
}

export function getDb(path?: string): Db {
  const target = path ?? process.env.DATABASE_PATH ?? './data/app.db';
  if (instance && instancePath === target) return instance;
  instance = openDatabase(target);
  instancePath = target;
  return instance;
}

export function closeDb(): void {
  instance?.close();
  instance = undefined;
  instancePath = undefined;
}

/** node:sqlite liefert Objekte mit null-Prototyp — in einfache Objekte wandeln. */
export function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function plainAll<T>(rows: unknown[]): T[] {
  return rows.map((r) => plain<T>(r));
}
