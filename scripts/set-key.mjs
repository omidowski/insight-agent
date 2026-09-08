/**
 * Trägt den OpenAI-Schlüssel sicher in .env.local ein.
 * Die Eingabe bleibt unsichtbar, der Wert wird nie ausgegeben und nie über die Kommandozeile
 * übergeben (kein Shell-Quoting, keine Terminal-Historie).
 */
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

const FILE = process.argv[2] ?? '.env.local';

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

const raw = await askHidden('OpenAI-Schlüssel einfügen (bleibt unsichtbar) und Enter: ');
const key = raw.trim().replace(/^["']|["']$/g, '');

if (key.length === 0) {
  console.log('✗ Keine Eingabe — Datei unverändert.');
  process.exit(1);
}
const PROVIDERS = [
  { prefix: 'sk-', variable: 'OPENAI_API_KEY', provider: 'openai', label: 'OpenAI' },
  { prefix: 'nvapi-', variable: 'NVIDIA_API_KEY', provider: 'nvidia', label: 'NVIDIA NIM' },
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

const existing = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
let lines = existing.split('\n');
lines = upsert(lines, detected.variable, key);
lines = upsert(lines, 'LLM_PROVIDER', detected.provider);

writeFileSync(FILE, lines.join('\n'), { mode: 0o600 });
chmodSync(FILE, 0o600);
console.log(`✓ ${detected.label}-Schlüssel in ${FILE} eingetragen (${key.length} Zeichen, Dateirechte 600).`);
console.log(`✓ LLM_PROVIDER=${detected.provider} gesetzt.\n`);

const check = spawnSync(process.execPath, ['scripts/check-llm.mjs'], { stdio: 'inherit' });
process.exit(check.status ?? 0);
