import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'scripts/sync-vector-db.ts');
const config = resolve(root, 'vitest.config.ts');

const result = spawnSync('npx', ['vite-node', '--config', config, target], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
