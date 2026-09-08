/**
 * Diagnose: prüft den konfigurierten LLM-Anbieter, seinen Schlüssel und die Modelle.
 * Gibt Schlüssel niemals aus — nur Länge, Präfix und Ergebnis.
 */
import { readFileSync, existsSync } from 'node:fs';

function loadEnvLocal() {
  const out = {};
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };

const openaiKey = (env.OPENAI_API_KEY ?? '').trim();
const nvidiaKey = (env.NVIDIA_API_KEY ?? '').trim();
const customKey = (env.LLM_API_KEY ?? '').trim();

let provider = env.LLM_PROVIDER && env.LLM_PROVIDER !== 'auto' ? env.LLM_PROVIDER : null;
if (!provider) provider = openaiKey ? 'openai' : nvidiaKey ? 'nvidia' : customKey ? 'compatible' : 'fixture';

const SETUP = {
  openai: {
    label: 'OpenAI',
    key: openaiKey,
    baseUrl: 'https://api.openai.com/v1',
    fast: env.OPENAI_MODEL_FAST || 'gpt-5-mini',
    main: env.OPENAI_MODEL_MAIN || 'gpt-5-mini',
    endpoint: 'responses',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    key: nvidiaKey,
    baseUrl: env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    fast: env.NVIDIA_MODEL_FAST || 'meta/llama-3.3-70b-instruct',
    main: env.NVIDIA_MODEL_MAIN || 'meta/llama-3.3-70b-instruct',
    endpoint: 'chat',
  },
  compatible: {
    label: 'OpenAI-kompatibel',
    key: customKey,
    baseUrl: env.LLM_BASE_URL || '',
    fast: env.LLM_MODEL_FAST || 'unbekannt',
    main: env.LLM_MODEL_MAIN || 'unbekannt',
    endpoint: 'chat',
  },
};

if (provider === 'fixture') {
  console.log('Demo-Modus: kein Schlüssel konfiguriert — es antwortet kein Sprachmodell.');
  console.log('Trage mit `npm run set-key` einen Schlüssel ein (OpenAI "sk-…" oder NVIDIA "nvapi-…").');
  process.exit(1);
}

const cfg = SETUP[provider];
console.log('Konfiguration');
console.log(`  Anbieter          : ${cfg.label} (LLM_PROVIDER=${provider})`);
console.log(`  Basis-URL         : ${cfg.baseUrl}`);
console.log(`  Schlüssel gesetzt : ${cfg.key.length > 0 ? 'ja' : 'NEIN'}`);
console.log(`  Länge             : ${cfg.key.length} Zeichen`);
console.log(`  Modell (fast)     : ${cfg.fast}`);
console.log(`  Modell (main)     : ${cfg.main}`);
console.log('');

if (cfg.key.length < 20) {
  console.log(`✗ Kein gültiger Schlüssel für ${cfg.label}. Setze ihn mit \`npm run set-key\`.`);
  process.exit(1);
}

async function call(path, init) {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let body = {};
  try { body = await res.json(); } catch { /* leer */ }
  return { status: res.status, body };
}

console.log(`Prüfe Schlüssel gegen ${cfg.baseUrl} …`);
const models = await call('/models');
if (models.status === 401 || models.status === 403) {
  console.log(`✗ ${models.status} — der Schlüssel wird abgelehnt (ungültig oder widerrufen).`);
  process.exit(1);
}
if (models.status !== 200) {
  console.log(`✗ Unerwarteter Status ${models.status}: ${models.body?.error?.message ?? ''}`);
  process.exit(1);
}
console.log('✓ Schlüssel ist gültig.');

const available = new Set((models.body.data ?? []).map((m) => m.id));
let failed = false;

for (const [label, model] of [['fast', cfg.fast], ['main', cfg.main]]) {
  if (label === 'main' && cfg.main === cfg.fast) continue;
  console.log(`\nPrüfe Modell „${model}" (${label}) …`);
  if (available.size > 0 && !available.has(model)) {
    console.log('  ! Nicht in der Modellliste dieses Kontos.');
  }
  const probe = cfg.endpoint === 'responses'
    ? await call('/responses', {
        method: 'POST',
        body: JSON.stringify({ model, input: 'Antworte nur mit: ok', max_output_tokens: 16 }),
      })
    : await call('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Antworte nur mit: ok' }],
          max_tokens: 16,
        }),
      });

  if (probe.status === 200) {
    console.log('  ✓ Testaufruf erfolgreich.');
  } else {
    failed = true;
    console.log(`  ✗ Status ${probe.status}: ${probe.body?.error?.message ?? probe.body?.detail ?? ''}`);
    if (probe.body?.error?.code) console.log(`    code: ${probe.body.error.code}`);
  }
}

if (failed && available.size > 0) {
  const candidates = [...available].sort().slice(0, 20);
  console.log('\nVerfügbare Modelle dieses Kontos (Auszug):');
  for (const m of candidates) console.log(`  ${m}`);
}

process.exit(failed ? 1 : 0);
