/**
 * Trägt den OpenAI-Schlüssel sicher in .env.local ein.
 * Die Eingabe bleibt unsichtbar, der Wert wird nie ausgegeben und nie über die Kommandozeile
 * übergeben (kein Shell-Quoting, keine Terminal-Historie).
 */
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const toHermes = args.includes('--hermes');
const positional = args.find((a) => !a.startsWith('--'));
const FILE = positional ?? (toHermes ? `${process.env.HOME}/.hermes/.env` : '.env.local');

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (chunk) => {
      if (!muted) rl.output.write(chunk);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const raw = await askHidden('Schlüssel einfügen — OpenAI "sk-…" oder NVIDIA "nvapi-…" (bleibt unsichtbar), dann Enter: ');
const key = raw.trim().replace(/^["']|["']$/g, '');

if (key.length === 0) {
  console.log('✗ Keine Eingabe — Datei unverändert.');
  process.exit(1);
}
const PROVIDERS = [
  { prefix: 'sk-', variable: 'OPENAI_API_KEY', provider: 'openai', label: 'OpenAI', hermesProvider: 'openai' },
  { prefix: 'nvapi-', variable: 'NVIDIA_API_KEY', provider: 'nvidia', label: 'NVIDIA NIM', hermesProvider: 'nvidia' },
];
const detected = PROVIDERS.find((p) => key.startsWith(p.prefix));
if (!detected) {
  console.log(`✗ Unbekanntes Schlüsselformat (Länge: ${key.length}). Erwartet: "sk-…" (OpenAI) oder "nvapi-…" (NVIDIA). Datei unverändert.`);
  process.exit(1);
}
if (key.length < 40) {
  console.log(`✗ Der Wert ist mit ${key.length} Zeichen zu kurz für einen OpenAI-Schlüssel. Datei unverändert.`);
  process.exit(1);
}
if (/\s/.test(key)) {
  console.log('✗ Der Wert enthält Leerzeichen oder Zeilenumbrüche. Datei unverändert.');
  process.exit(1);
}

function upsert(lines, variable, value) {
  const pattern = new RegExp(`^\\s*${variable}\\s*=`);
  let replaced = false;
  const updated = lines.map((line) => {
    if (pattern.test(line)) {
      replaced = true;
      return `${variable}=${value}`;
    }
    return line;
  });
  if (!replaced) updated.push(`${variable}=${value}`);
  return updated;
}

if (toHermes) mkdirSync(dirname(FILE), { recursive: true });

const existing = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
let lines = existing.split('\n');
lines = upsert(lines, detected.variable, key);

writeFileSync(FILE, lines.join('\n'), { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log(`✓ ${detected.label}-Schlüssel in ${FILE} eingetragen (${key.length} Zeichen, Dateirechte 600).`);

if (toHermes) {
  // Der Schlüssel liegt jetzt in Hermes; die App ruft Hermes auf und braucht selbst keinen.
  const local = '.env.local';
  if (existsSync(local)) {
    let localLines = readFileSync(local, 'utf8').split('\n');
    localLines = upsert(localLines, 'LLM_PROVIDER', 'hermes');
    localLines = upsert(localLines, 'HERMES_PROVIDER', detected.hermesProvider ?? 'nvidia');
    writeFileSync(local, localLines.join('\n'), { mode: 0o600 });
    console.log(`✓ ${local}: LLM_PROVIDER=hermes, HERMES_PROVIDER=${detected.hermesProvider ?? 'nvidia'}`);
  }
  console.log('');
} else {
  let lines2 = readFileSync(FILE, 'utf8').split('\n');
  lines2 = upsert(lines2, 'LLM_PROVIDER', detected.provider);
  writeFileSync(FILE, lines2.join('\n'), { mode: 0o600 });
  console.log(`✓ LLM_PROVIDER=${detected.provider} gesetzt.\n`);
}

const check = spawnSync(process.execPath, ['scripts/check-llm.mjs'], { stdio: 'inherit' });
process.exit(check.status ?? 0);
