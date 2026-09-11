/** Zentrale, validierte Konfiguration (Spec 43). Nur serverseitig verwenden. */
import { z } from 'zod';
import type { RunBudgets } from '@/lib/contracts/domain';

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : /^(1|true|yes|on)$/i.test(v)));

const envSchema = z.object({
  LLM_PROVIDER: z.enum(['auto', 'openai', 'nvidia', 'compatible', 'hermes']).default('auto'),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL_FAST: z.string().default('gpt-5-mini'),
  OPENAI_MODEL_MAIN: z.string().default('gpt-5-mini'),
  NVIDIA_API_KEY: z.string().trim().optional(),
  NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_MODEL_FAST: z.string().default('nvidia/nemotron-3.5-lightning-30b-a3b'),
  NVIDIA_MODEL_MAIN: z.string().default('nvidia/nemotron-3.5-lightning-30b-a3b'),
  // Hermes-Agent-CLI als Anbieter: die Zugangsdaten liegen dann in ~/.hermes/.env (ADR-015).
  HERMES_BIN: z.string().default('hermes'),
  HERMES_PROVIDER: z.string().default('nvidia'),
  HERMES_MODEL_FAST: z.string().default('nvidia/nemotron-3.5-lightning-30b-a3b'),
  HERMES_MODEL_MAIN: z.string().default('nvidia/nemotron-3.5-lightning-30b-a3b'),
  /** Wurzelverzeichnis der Hermes-Installation — dort liegt die Python-Umgebung für die Websuche. */
  HERMES_HOME: z.string().default(''),
  /** Suchrückgriff in Hermes: 'ddgs' braucht keinen Schlüssel. */
  HERMES_SEARCH_BACKEND: z.string().default('ddgs'),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().trim().optional(),
  LLM_MODEL_FAST: z.string().optional(),
  LLM_MODEL_MAIN: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  /**
   * Schaltet den internen Denkschritt von Reasoning-Modellen ab.
   * Bei NVIDIA-Nemotron sinkt die Antwortzeit dadurch von rund 50 auf 13 Sekunden —
   * für Zwischenschritte wie Textauswertung ist das der Unterschied zwischen
   * benutzbar und unbrauchbar. 'auto' schaltet nur bei NVIDIA ab.
   */
  LLM_DISABLE_THINKING: z.enum(['auto', 'on', 'off']).default('auto'),
  SEARCH_PROVIDER: z.enum(['auto', 'openai', 'brave', 'tavily', 'hermes']).default('auto'),
  BRAVE_API_KEY: z.string().trim().optional(),
  BRAVE_BASE_URL: z.string().default('https://api.search.brave.com/res/v1'),
  TAVILY_API_KEY: z.string().trim().optional(),
  TAVILY_BASE_URL: z.string().default('https://api.tavily.com'),
  DATABASE_PATH: z.string().default('./data/app.db'),
  /** Nur für automatisierte Tests: erlaubt Abrufe gegen 127.0.0.1 (lokaler Testserver). */
  ALLOW_LOOPBACK_FETCH: boolish.default(false),
  AUTH_ENABLED: boolish.default(false),
  MAX_RUN_COST_USD: z.coerce.number().nonnegative().default(0.5),
  MAX_RUN_WALL_CLOCK_MS: z.coerce.number().int().positive().default(180000),
  MAX_RESEARCH_ITERATIONS: z.coerce.number().int().positive().default(3),
  MAX_SEARCHES: z.coerce.number().int().positive().default(12),
  MAX_SOURCES: z.coerce.number().int().positive().default(15),
  MAX_TOOL_CALLS: z.coerce.number().int().positive().default(40),
  MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(150000),
  MAX_PLAN_STEPS: z.coerce.number().int().positive().default(8),
  MAX_REPLANS: z.coerce.number().int().nonnegative().default(2),
  MAX_SOURCES_PER_STEP: z.coerce.number().int().positive().default(5),
  MAX_QUERIES_PER_STEP: z.coerce.number().int().positive().default(3),
  MAX_SOURCES_PER_DOMAIN: z.coerce.number().int().positive().default(3),
  STEP_CONCURRENCY: z.coerce.number().int().positive().default(3),
  SEARCH_MAX_RESULTS: z.coerce.number().int().positive().default(8),
  EXTRACTION_MAX_CHARS: z.coerce.number().int().positive().default(12000),
  FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  FETCH_MAX_BYTES: z.coerce.number().int().positive().default(2_000_000),
  FETCH_USER_AGENT: z.string().default('InsightAgent/0.1 (+research assistant; respects robots.txt)'),
  RESPECT_ROBOTS: boolish.default(true),
  TOOL_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  TOOL_RESULT_TOKEN_BUDGET: z.coerce.number().int().positive().default(1500),
  RATE_LIMIT_ENABLED: boolish.default(true),
  RATE_LIMIT_RUNS_PER_HOUR: z.coerce.number().int().positive().default(30),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().default(6),
  DOMAIN_RATE_LIMIT_MS: z.coerce.number().int().nonnegative().default(1000),
  ROUTER_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  ROUTER_CLARIFY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.4),
  MIN_SOURCES_PER_CLAIM: z.coerce.number().int().positive().default(2),
  MIN_STEP_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  MIN_TRUST_FOR_USE: z.coerce.number().min(0).max(1).default(0.3),
  CONFLICT_NUMERIC_TOLERANCE: z.coerce.number().min(0).max(1).default(0.01),
  HISTORY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(12),
  RUN_STALE_AFTER_MS: z.coerce.number().int().positive().default(300000),
  SSE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(120),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(15000),
  SSE_MAX_DURATION_MS: z.coerce.number().int().positive().default(600000),
  SHOW_COSTS: boolish.default(false),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_VERSION: z.string().default('0.1.0'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export type LlmProviderName = 'openai' | 'nvidia' | 'compatible' | 'hermes' | 'none';

export interface AppConfig extends EnvConfig {
  /** true, sobald ein LLM-Anbieter vollständig konfiguriert ist. */
  isConfigured: boolean;
  /** Tatsächlich aktiver LLM-Anbieter nach Auflösung von `auto`. */
  llmProvider: LlmProviderName;
  /** Anzeigename und Modelle des aktiven Anbieters. */
  activeModelFast: string;
  activeModelMain: string;
  defaultBudgets: RunBudgets;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Ungültige Konfiguration: ${issues}`);
  }
  const env = parsed.data;

  // Aktiver LLM-Anbieter (ADR-012). 'none' = nicht konfiguriert; die App antwortet dann nicht,
  // sondern verlangt eine Einrichtung. Simulierte Antworten gibt es nicht (ADR-013).
  const resolvedProvider: LlmProviderName =
    env.LLM_PROVIDER !== 'auto'
      ? env.LLM_PROVIDER
      : env.OPENAI_API_KEY
        ? 'openai'
        : env.NVIDIA_API_KEY
          ? 'nvidia'
          : env.LLM_API_KEY && env.LLM_BASE_URL
            ? 'compatible'
            : 'none';

  if (resolvedProvider === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('Ungültige Konfiguration: OPENAI_API_KEY fehlt für LLM_PROVIDER=openai');
  }
  if (resolvedProvider === 'nvidia' && !env.NVIDIA_API_KEY) {
    throw new Error('Ungültige Konfiguration: NVIDIA_API_KEY fehlt für LLM_PROVIDER=nvidia');
  }
  if (resolvedProvider === 'compatible' && (!env.LLM_API_KEY || !env.LLM_BASE_URL)) {
    throw new Error('Ungültige Konfiguration: LLM_API_KEY und LLM_BASE_URL werden für LLM_PROVIDER=compatible benötigt');
  }
  // Für 'hermes' prüft die App nichts: die Zugangsdaten verwaltet Hermes in ~/.hermes/.env.

  if (env.SEARCH_PROVIDER === 'brave' && !env.BRAVE_API_KEY) {
    throw new Error('Ungültige Konfiguration: BRAVE_API_KEY fehlt für SEARCH_PROVIDER=brave');
  }
  if (env.SEARCH_PROVIDER === 'tavily' && !env.TAVILY_API_KEY) {
    throw new Error('Ungültige Konfiguration: TAVILY_API_KEY fehlt für SEARCH_PROVIDER=tavily');
  }

  const activeModelFast =
    resolvedProvider === 'nvidia' ? env.NVIDIA_MODEL_FAST
      : resolvedProvider === 'hermes' ? env.HERMES_MODEL_FAST
        : resolvedProvider === 'compatible' ? (env.LLM_MODEL_FAST ?? env.OPENAI_MODEL_FAST)
          : env.OPENAI_MODEL_FAST;
  const activeModelMain =
    resolvedProvider === 'nvidia' ? env.NVIDIA_MODEL_MAIN
      : resolvedProvider === 'hermes' ? env.HERMES_MODEL_MAIN
        : resolvedProvider === 'compatible' ? (env.LLM_MODEL_MAIN ?? env.OPENAI_MODEL_MAIN)
          : env.OPENAI_MODEL_MAIN;

  const config: AppConfig = {
    ...env,
    isConfigured: resolvedProvider !== 'none',
    llmProvider: resolvedProvider,
    activeModelFast,
    activeModelMain,
    defaultBudgets: {
      maxIterations: env.MAX_RESEARCH_ITERATIONS,
      maxSearches: env.MAX_SEARCHES,
      maxSources: env.MAX_SOURCES,
      maxWallClockMs: env.MAX_RUN_WALL_CLOCK_MS,
      maxInputTokens: env.MAX_INPUT_TOKENS,
      maxCostMicroUsd: Math.round(env.MAX_RUN_COST_USD * 1_000_000),
      maxToolCalls: env.MAX_TOOL_CALLS,
    },
  };
  cached = Object.freeze(config);
  return cached;
}

/** Nur für Tests: erzwingt Neuauswertung der Umgebung. */
export function resetConfig(): void {
  cached = undefined;
}
