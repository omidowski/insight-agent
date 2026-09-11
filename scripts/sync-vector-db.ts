/**
 * CLI-Skript: Synchronisiert alle Prompts und generierten Daten in den Vector Store.
 * Aufruf: node scripts/sync-vector-db.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { getRepositories } from '@/lib/db/repositories';

// .env.local laden
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      const key = m?.[1];
      const val = m?.[2];
      if (key && process.env[key] === undefined) {
        process.env[key] = val?.replace(/^["']|["']$/g, '');
      }
    }
  }
}

async function main() {
  console.log('⚡ Starte Vektor-DB-Synchronisierung über alle Prompts und generierten Daten...');

  const repos = getRepositories();
  const statsBefore = repos.vectors.stats();
  console.log(`Aktueller Bestand: ${statsBefore.total} Vektoren (Modell: ${statsBefore.model}, ${statsBefore.dimensions}d)`);

  const result = await repos.vectors.syncAll();
  console.log(`\n✓ Synchronisierung erfolgreich in ${result.durationMs}ms!`);
  console.log(`  Neu/Aktualisiert: ${result.indexed} Vektoren\n`);

  console.log('Aufschlüsselung nach Typ:');
  for (const [type, count] of Object.entries(result.byType)) {
    console.log(`  - ${type.padEnd(12)}: ${count}`);
  }

  const statsAfter = repos.vectors.stats();
  console.log(`\nGesamtbestand in Vector DB: ${statsAfter.total} Einträge`);
}

main().catch((err) => {
  console.error('Fehler bei der Vektor-Synchronisierung:', err);
  process.exit(1);
});
