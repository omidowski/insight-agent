/** Migrationen als TS-Module (ADR-009) — SQL bleibt unverändert lesbar. */

export interface Migration { name: string; sql: string }

export const MIGRATIONS: Migration[] = [
  {
    name: '001_init',
    sql: `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  request_message_id TEXT NOT NULL,
  response_message_id TEXT,
  task_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  plan_json TEXT,
  current_step_id TEXT,
  budgets_json TEXT NOT NULL,
  usage_json TEXT NOT NULL,
  cost_micro_usd INTEGER NOT NULL DEFAULT 0,
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_conversation ON runs(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL,
  depends_on_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_steps_run ON run_steps(run_id, seq);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  ts TEXT NOT NULL,
  UNIQUE(run_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_events_run ON run_events(run_id, seq);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  status TEXT NOT NULL,
  result_summary TEXT,
  error_code TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_toolcalls_run ON tool_calls(run_id, created_at);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  index_num INTEGER NOT NULL,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  published_at TEXT,
  fetched_at TEXT,
  source_type TEXT NOT NULL,
  trust_score REAL NOT NULL DEFAULT 0.5,
  content_hash TEXT,
  raw_text_len INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, canonical_url)
);
CREATE INDEX IF NOT EXISTS idx_sources_run ON sources(run_id, index_num);
CREATE INDEX IF NOT EXISTS idx_sources_conversation ON sources(conversation_id);

CREATE TABLE IF NOT EXISTS excerpts (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  claim_key TEXT,
  extracted_value TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_excerpts_source ON excerpts(source_id);
CREATE INDEX IF NOT EXISTS idx_excerpts_run ON excerpts(run_id);

CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  excerpt_id TEXT,
  marker INTEGER NOT NULL,
  claim_text TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_citations_message ON citations(message_id);

CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  claim_key TEXT NOT NULL,
  description TEXT NOT NULL,
  entries_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conflicts_run ON conflicts(run_id);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micro_usd INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_run ON usage_events(run_id);
`,
  },
  {
    name: '002_cancel_flag',
    sql: `
ALTER TABLE runs ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    name: '003_model_override',
    sql: `
ALTER TABLE runs ADD COLUMN model_override TEXT;
`,
  },
  {
    name: '004_vector_entries',
    sql: `
CREATE TABLE IF NOT EXISTS vector_entries (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  parent_id TEXT,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  embedding BLOB NOT NULL,
  dimensions INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_vector_entries_type ON vector_entries(entity_type);
CREATE INDEX IF NOT EXISTS idx_vector_entries_parent ON vector_entries(parent_id);
CREATE INDEX IF NOT EXISTS idx_vector_entries_created ON vector_entries(created_at);
`,
  },
  {
    name: '005_research_options',
    sql: `
ALTER TABLE runs ADD COLUMN research_options_json TEXT;
`,
  },
];
