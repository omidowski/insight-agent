/**
 * Websuche über die Hermes-Agent-Installation (Spec 19, ADR-013).
 *
 * Hermes bringt einen eigenen Werkzeugsatz „web" mit. Diese Anbindung ruft dessen
 * Suchfunktion direkt in Hermes' Python-Umgebung auf — ohne Umweg über ein Sprachmodell.
 * Das hat drei Folgen, die bewusst so gewollt sind:
 *
 * - **Kein Schlüssel nötig.** Der Rückgriff `ddgs` (DuckDuckGo) arbeitet ohne Konto.
 *   Ist in Hermes ein stärkerer Anbieter hinterlegt (Firecrawl, Tavily, Brave), lässt
 *   sich der über HERMES_SEARCH_BACKEND wählen.
 * - **Kein Modellaufruf.** Die Suche ist deterministisch und kostet keine Token.
 * - **Die Suchanfrage ist ein Argument, kein Textbaustein.** Sie wird über `argv`
 *   übergeben, nie in den Python-Quelltext eingesetzt — sonst wäre sie ausführbarer Code.
 *
 * Treffer aus dem Netz sind DATEN, keine Anweisungen. Titel und Beschreibung werden
 * gekürzt und unverändert weitergereicht; die Auswertung übernimmt der übliche
 * Injection-Schutz weiter oben in der Kette.
 */
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { SearchProvider, SearchOptions } from './provider';
import type { SearchHit } from '@/lib/contracts/domain';
import { getConfig } from '@/lib/config/env';
import { appError, AppErrorException } from '@/lib/util/errors';
import { logger } from '@/lib/util/logger';

/** Ruft Hermes' Suchwerkzeug auf und gibt dessen JSON unverändert aus. */
const SCRIPT = `
import json, os, sys
sys.path.insert(0, os.getcwd())
query = sys.argv[1]
limit = int(sys.argv[2])
backend = sys.argv[3]
if backend:
    os.environ["WEB_SEARCH_BACKEND"] = backend
from tools.web_tools import _ensure_web_plugins_loaded, web_search_tool
_ensure_web_plugins_loaded()
sys.stdout.write(web_search_tool(query, limit))
`;

interface HermesWebHit {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  position?: unknown;
}

/** Wurzel der Hermes-Installation; HERMES_HOME schlägt die Vermutung im Benutzerverzeichnis. */
export function hermesAgentRoot(): string | undefined {
  const configured = getConfig().HERMES_HOME.trim();
  const root = configured.length > 0 ? configured : join(homedir(), '.hermes');
  const agent = join(root, 'hermes-agent');
  return existsSync(join(agent, 'venv', 'bin', 'python3')) ? agent : undefined;
}

/** Ist die Hermes-Suche einsatzbereit? */
export function hasHermesSearch(): boolean {
  return hermesAgentRoot() !== undefined;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export class HermesSearchProvider implements SearchProvider {
  readonly name = 'Hermes Web';

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const agent = hermesAgentRoot();
    if (!agent) {
      throw new AppErrorException(
        appError('SEARCH_NOT_CONFIGURED', 'Hermes-Installation nicht gefunden', {
          retryable: false,
          userMessage:
            'Die Hermes-Installation wurde nicht gefunden. Setze HERMES_HOME in .env.local auf das Verzeichnis mit „hermes-agent".',
        }),
      );
    }

    const config = getConfig();
    const python = join(agent, 'venv', 'bin', 'python3');
    const args = ['-c', SCRIPT, query, String(opts.maxResults), config.HERMES_SEARCH_BACKEND];

    // DuckDuckGo drosselt wiederholte Anfragen und antwortet dann mit einer leeren
    // Trefferliste statt mit einem Fehler. Ein zweiter Versuch nach kurzer Pause
    // liefert in dem Fall meist Ergebnisse.
    let raw = await this.run(python, args, agent, opts.signal);
    let hits = this.parse(raw, opts.maxResults);
    if (hits.length === 0 && !opts.signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (!opts.signal?.aborted) {
        raw = await this.run(python, args, agent, opts.signal);
        hits = this.parse(raw, opts.maxResults);
      }
    }
    logger.debug('hermes search', { module: 'search', backend: config.HERMES_SEARCH_BACKEND, hits: hits.length });
    return hits;
  }

  /** Wandelt die JSON-Antwort von Hermes in SearchHits; Treffer sind DATEN, keine Anweisungen. */
  private parse(raw: string, maxResults: number): SearchHit[] {

    let parsed: { success?: unknown; error?: unknown; data?: { web?: unknown } };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new AppErrorException(
        appError('SEARCH_FAILED', `Hermes lieferte kein JSON: ${raw.slice(0, 200)}`, {
          retryable: true,
          userMessage: 'Die Websuche über Hermes hat unerwartet geantwortet.',
        }),
      );
    }

    if (typeof parsed.error === 'string') {
      throw new AppErrorException(
        appError('SEARCH_NOT_CONFIGURED', `Hermes-Suche: ${parsed.error}`, {
          retryable: false,
          userMessage:
            'Die Websuche über Hermes ist nicht eingerichtet. Installiere das Paket „ddgs" in Hermes oder hinterlege dort einen Suchanbieter.',
        }),
      );
    }

    const web = Array.isArray(parsed.data?.web) ? (parsed.data.web as HermesWebHit[]) : [];
    const hits: SearchHit[] = [];
    for (const entry of web) {
      const url = text(entry.url, 2000);
      if (url.length === 0) continue;
      hits.push({
        title: text(entry.title, 300) || url,
        url,
        snippet: text(entry.description, 1000),
        rank: hits.length + 1,
      });
      if (hits.length >= maxResults) break;
    }
    return hits;
  }

  private run(bin: string, args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      // Ohne Shell: die Suchanfrage bleibt ein Argument und wird nie interpretiert.
      const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, getConfig().FETCH_TIMEOUT_MS * 3);

      const onAbort = () => child.kill('SIGKILL');
      signal?.addEventListener('abort', onAbort, { once: true });

      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < 1_000_000) stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < 20_000) stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(
          new AppErrorException(
            appError('SEARCH_FAILED', `Hermes nicht startbar: ${String(err)}`, {
              retryable: false,
              userMessage: 'Die Websuche über Hermes konnte nicht gestartet werden.',
            }),
          ),
        );
      });
      child.on('close', (code) => {
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        const body = stdout.trim();
        if (body.length > 0) {
          resolve(body);
          return;
        }
        reject(
          new AppErrorException(
            appError('SEARCH_FAILED', `Hermes-Suche endete mit Code ${code}: ${stderr.slice(0, 300)}`, {
              retryable: true,
              userMessage: 'Die Websuche über Hermes ist fehlgeschlagen.',
            }),
          ),
        );
      });
    });
  }
}
