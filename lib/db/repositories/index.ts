/** Repositories — einziger SQL-Zugriffspunkt (Spec 04, FR-04-03). */
import type { Db } from '../client';
import { getDb, plain, plainAll } from '../client';
import { newId } from '@/lib/util/id';
import { nowIso } from '@/lib/util/time';
import { logger } from '@/lib/util/logger';
import type {
  Citation, Conflict, ConflictEntry, Conversation, Message, MessageRole, MessageStatus,
  PlanStep, Run, RunBudgets, RunStatus, BudgetUsage, SourceRecord, SourceStatus, SourceType,
  StepStatus, TaskType, ToolCallRecord, ExcerptRecord, UsageEvent,
} from '@/lib/contracts/domain';
import type { AgentEvent, EventType } from '@/lib/contracts/events';
import { isEventType } from '@/lib/contracts/events';

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn('DB_CORRUPT_JSON', { module: 'db' });
    return fallback;
  }
}

export const LOCAL_USER_ID = 'usr_local';

export function createRepositories(db: Db) {
  const users = {
    ensureLocal(): string {
      const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(LOCAL_USER_ID);
      if (!existing) {
        db.prepare('INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)').run(
          LOCAL_USER_ID, null, 'Lokaler Nutzer', nowIso(),
        );
      }
      return LOCAL_USER_ID;
    },
  };

  const conversations = {
    create(userId: string, title = 'Neuer Chat'): Conversation {
      const id = newId('cnv');
      const ts = nowIso();
      db.prepare(
        'INSERT INTO conversations (id, user_id, title, created_at, updated_at, archived_at) VALUES (?,?,?,?,?,NULL)',
      ).run(id, userId, title, ts, ts);
      return { id, userId, title, createdAt: ts, updatedAt: ts, archivedAt: null };
    },
    get(id: string, userId: string): Conversation | undefined {
      const row = db
        .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
        .get(id, userId);
      if (!row) return undefined;
      const r = plain<Record<string, unknown>>(row);
      return {
        id: r.id as string, userId: r.user_id as string, title: r.title as string,
        createdAt: r.created_at as string, updatedAt: r.updated_at as string,
        archivedAt: (r.archived_at as string | null) ?? null,
      };
    },
    listByUser(userId: string, limit = 100): (Conversation & { messageCount: number; lastRunStatus: RunStatus | null })[] {
      const rows = db.prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
                (SELECT r.status FROM runs r WHERE r.conversation_id = c.id ORDER BY r.created_at DESC LIMIT 1) AS last_run_status
         FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT ?`,
      ).all(userId, limit);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, userId: r.user_id as string, title: r.title as string,
        createdAt: r.created_at as string, updatedAt: r.updated_at as string,
        archivedAt: (r.archived_at as string | null) ?? null,
        messageCount: Number(r.message_count ?? 0),
        lastRunStatus: (r.last_run_status as RunStatus | null) ?? null,
      }));
    },
    rename(id: string, userId: string, title: string): boolean {
      const res = db
        .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(title.replace(/\s+/g, ' ').trim().slice(0, 120), nowIso(), id, userId);
      return Number(res.changes) > 0;
    },
    touch(id: string): void {
      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(nowIso(), id);
    },
    /** Löscht endgültig — Nachrichten, Läufe, Quellen und Belege werden mitgelöscht. */
    remove(id: string, userId: string): boolean {
      const res = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(id, userId);
      return Number(res.changes) > 0;
    },
  };

  const messages = {
    create(conversationId: string, role: MessageRole, content: string, status: MessageStatus, runId: string | null = null): Message {
      const id = newId('msg');
      const ts = nowIso();
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, status, run_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      ).run(id, conversationId, role, content, status, runId, ts, ts);
      return { id, conversationId, role, content, status, runId, createdAt: ts, updatedAt: ts };
    },
    setContent(id: string, content: string, status?: MessageStatus): void {
      if (status) {
        db.prepare('UPDATE messages SET content = ?, status = ?, updated_at = ? WHERE id = ?')
          .run(content, status, nowIso(), id);
      } else {
        db.prepare('UPDATE messages SET content = ?, updated_at = ? WHERE id = ?')
          .run(content, nowIso(), id);
      }
    },
    get(id: string): Message | undefined {
      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
      if (!row) return undefined;
      const r = plain<Record<string, unknown>>(row);
      return {
        id: r.id as string, conversationId: r.conversation_id as string,
        role: r.role as MessageRole, content: r.content as string,
        status: r.status as MessageStatus, runId: (r.run_id as string | null) ?? null,
        createdAt: r.created_at as string, updatedAt: r.updated_at as string,
      };
    },
    listByConversation(conversationId: string, limit = 200): Message[] {
      const rows = db
        .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC LIMIT ?')
        .all(conversationId, limit);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, conversationId: r.conversation_id as string,
        role: r.role as MessageRole, content: r.content as string,
        status: r.status as MessageStatus, runId: (r.run_id as string | null) ?? null,
        createdAt: r.created_at as string, updatedAt: r.updated_at as string,
      }));
    },
  };

  function mapRun(r: Record<string, unknown>): Run {
    return {
      id: r.id as string,
      conversationId: r.conversation_id as string,
      userId: r.user_id as string,
      requestMessageId: r.request_message_id as string,
      responseMessageId: (r.response_message_id as string | null) ?? null,
      taskType: r.task_type as TaskType,
      confidence: Number(r.confidence ?? 0),
      status: r.status as RunStatus,
      plan: parseJson<PlanStep[]>((r.plan_json as string | null) ?? null, []),
      currentStepId: (r.current_step_id as string | null) ?? null,
      budgets: parseJson<RunBudgets>(r.budgets_json as string, {
        maxIterations: 1, maxSearches: 1, maxSources: 1, maxWallClockMs: 60000,
        maxInputTokens: 100000, maxCostMicroUsd: 100000, maxToolCalls: 10,
      }),
      usage: parseJson<BudgetUsage>(r.usage_json as string, {
        iterations: 0, searches: 0, sources: 0, toolCalls: 0, inputTokens: 0,
        outputTokens: 0, costMicroUsd: 0, startedAt: r.created_at as string,
      }),
      costMicroUsd: Number(r.cost_micro_usd ?? 0),
      error: parseJson<{ code: string; userMessage: string } | null>((r.error_json as string | null) ?? null, null),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      finishedAt: (r.finished_at as string | null) ?? null,
      modelOverride: (r.model_override as string | null) ?? null,
    };
  }

  const runs = {
    create(input: {
      conversationId: string; userId: string; requestMessageId: string;
      taskType: TaskType; budgets: RunBudgets; modelOverride?: string | null;
    }): Run {
      const id = newId('run');
      const ts = nowIso();
      const usage: BudgetUsage = {
        iterations: 0, searches: 0, sources: 0, toolCalls: 0,
        inputTokens: 0, outputTokens: 0, costMicroUsd: 0, startedAt: ts,
      };
      db.prepare(
        `INSERT INTO runs (id, conversation_id, user_id, request_message_id, response_message_id, task_type,
          confidence, status, plan_json, current_step_id, budgets_json, usage_json, cost_micro_usd,
          error_json, created_at, updated_at, finished_at, model_override)
         VALUES (?,?,?,?,NULL,?,0,'idle',NULL,NULL,?,?,0,NULL,?,?,NULL,?)`,
      ).run(id, input.conversationId, input.userId, input.requestMessageId, input.taskType,
        JSON.stringify(input.budgets), JSON.stringify(usage), ts, ts, input.modelOverride ?? null);
      return mapRun({
        id, conversation_id: input.conversationId, user_id: input.userId,
        request_message_id: input.requestMessageId, task_type: input.taskType,
        status: 'idle', budgets_json: JSON.stringify(input.budgets),
        usage_json: JSON.stringify(usage), created_at: ts, updated_at: ts,
        model_override: input.modelOverride ?? null,
      });
    },
    get(id: string): Run | undefined {
      const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
      return row ? mapRun(plain<Record<string, unknown>>(row)) : undefined;
    },
    listByConversation(conversationId: string, limit = 50): Run[] {
      const rows = db
        .prepare('SELECT * FROM runs WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(conversationId, limit);
      return plainAll<Record<string, unknown>>(rows).map(mapRun);
    },
    requestCancel(id: string): void {
      db.prepare('UPDATE runs SET cancel_requested = 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
    },
    isCancelRequested(id: string): boolean {
      const row = db.prepare('SELECT cancel_requested FROM runs WHERE id = ?').get(id);
      if (!row) return false;
      return Number(plain<{ cancel_requested: number }>(row).cancel_requested) === 1;
    },
    update(id: string, patch: Partial<{
      status: RunStatus; taskType: TaskType; confidence: number; plan: PlanStep[];
      currentStepId: string | null; responseMessageId: string | null;
      usage: BudgetUsage; costMicroUsd: number;
      error: { code: string; userMessage: string } | null; finishedAt: string | null;
    }>): void {
      const fields: string[] = [];
      const values: (string | number | null)[] = [];
      if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status); }
      if (patch.taskType !== undefined) { fields.push('task_type = ?'); values.push(patch.taskType); }
      if (patch.confidence !== undefined) { fields.push('confidence = ?'); values.push(patch.confidence); }
      if (patch.plan !== undefined) { fields.push('plan_json = ?'); values.push(JSON.stringify(patch.plan)); }
      if (patch.currentStepId !== undefined) { fields.push('current_step_id = ?'); values.push(patch.currentStepId); }
      if (patch.responseMessageId !== undefined) { fields.push('response_message_id = ?'); values.push(patch.responseMessageId); }
      if (patch.usage !== undefined) { fields.push('usage_json = ?'); values.push(JSON.stringify(patch.usage)); }
      if (patch.costMicroUsd !== undefined) { fields.push('cost_micro_usd = ?'); values.push(patch.costMicroUsd); }
      if (patch.error !== undefined) { fields.push('error_json = ?'); values.push(patch.error ? JSON.stringify(patch.error) : null); }
      if (patch.finishedAt !== undefined) { fields.push('finished_at = ?'); values.push(patch.finishedAt); }
      fields.push('updated_at = ?');
      values.push(nowIso());
      values.push(id);
      db.prepare(`UPDATE runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    },
  };

  const steps = {
    createMany(runId: string, plan: PlanStep[]): void {
      const stmt = db.prepare(
        'INSERT INTO run_steps (id, run_id, seq, title, question, status, depends_on_json, result_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NULL,?,?)',
      );
      const ts = nowIso();
      for (const step of plan) {
        stmt.run(step.id, runId, step.seq, step.title, step.question, step.status,
          JSON.stringify(step.dependsOn), ts, ts);
      }
    },
    update(id: string, patch: { status?: StepStatus; result?: unknown }): void {
      const fields: string[] = [];
      const values: (string | null)[] = [];
      if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status); }
      if (patch.result !== undefined) { fields.push('result_json = ?'); values.push(JSON.stringify(patch.result)); }
      fields.push('updated_at = ?');
      values.push(nowIso());
      values.push(id);
      db.prepare(`UPDATE run_steps SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    },
    listByRun(runId: string): PlanStep[] {
      const rows = db.prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY seq ASC').all(runId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, seq: Number(r.seq), title: r.title as string,
        question: r.question as string, status: r.status as StepStatus,
        dependsOn: parseJson<string[]>(r.depends_on_json as string, []),
        result: parseJson<PlanStep['result']>((r.result_json as string | null) ?? null, undefined),
      }));
    },
  };

  const events = {
    append<T extends EventType>(
      runId: string, conversationId: string, type: T, payload: unknown,
    ): AgentEvent<T> {
      const id = newId('evt');
      const ts = nowIso();
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS max_seq FROM run_events WHERE run_id = ?').get(runId);
        const seq = Number((plain<{ max_seq: number }>(row)).max_seq) + 1;
        db.prepare('INSERT INTO run_events (id, run_id, seq, type, payload_json, ts) VALUES (?,?,?,?,?,?)')
          .run(id, runId, seq, type, JSON.stringify(payload), ts);
        db.exec('COMMIT');
        return { id, runId, conversationId, seq, ts, type, payload } as AgentEvent<T>;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    listByRun(runId: string, afterSeq = 0, limit = 500): AgentEvent[] {
      const rows = db
        .prepare('SELECT * FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
        .all(runId, afterSeq, limit);
      const conversationId = (() => {
        const r = db.prepare('SELECT conversation_id FROM runs WHERE id = ?').get(runId);
        return r ? (plain<{ conversation_id: string }>(r).conversation_id) : '';
      })();
      const out: AgentEvent[] = [];
      for (const raw of plainAll<Record<string, unknown>>(rows)) {
        const type = raw.type as string;
        if (!isEventType(type)) {
          logger.warn('unknown event type skipped', { module: 'db', type });
          continue;
        }
        out.push({
          id: raw.id as string, runId, conversationId,
          seq: Number(raw.seq), ts: raw.ts as string,
          type, payload: parseJson(raw.payload_json as string, {}),
        } as AgentEvent);
      }
      return out;
    },
    count(runId: string): number {
      const r = db.prepare('SELECT COUNT(*) AS n FROM run_events WHERE run_id = ?').get(runId);
      return Number(plain<{ n: number }>(r).n);
    },
  };

  const toolCalls = {
    start(runId: string, stepId: string | null, toolName: string, args: Record<string, unknown>): string {
      const id = newId('tcl');
      db.prepare(
        'INSERT INTO tool_calls (id, run_id, step_id, tool_name, args_json, status, created_at) VALUES (?,?,?,?,?,?,?)',
      ).run(id, runId, stepId, toolName, JSON.stringify(args), 'running', nowIso());
      return id;
    },
    finish(id: string, patch: { status: 'completed' | 'failed'; resultSummary?: string; errorCode?: string; durationMs: number }): void {
      db.prepare('UPDATE tool_calls SET status = ?, result_summary = ?, error_code = ?, duration_ms = ? WHERE id = ?')
        .run(patch.status, patch.resultSummary ?? null, patch.errorCode ?? null, patch.durationMs, id);
    },
    listByRun(runId: string): ToolCallRecord[] {
      const rows = db.prepare('SELECT * FROM tool_calls WHERE run_id = ? ORDER BY created_at ASC').all(runId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, runId, stepId: (r.step_id as string | null) ?? null,
        toolName: r.tool_name as string,
        args: parseJson<Record<string, unknown>>(r.args_json as string, {}),
        status: r.status as ToolCallRecord['status'],
        resultSummary: (r.result_summary as string | null) ?? null,
        errorCode: (r.error_code as string | null) ?? null,
        durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
        createdAt: r.created_at as string,
      }));
    },
  };

  function mapSource(r: Record<string, unknown>): SourceRecord {
    return {
      id: r.id as string, runId: r.run_id as string, conversationId: r.conversation_id as string,
      indexNum: Number(r.index_num), url: r.url as string, canonicalUrl: r.canonical_url as string,
      domain: r.domain as string, title: r.title as string,
      author: (r.author as string | null) ?? null,
      publishedAt: (r.published_at as string | null) ?? null,
      fetchedAt: (r.fetched_at as string | null) ?? null,
      sourceType: r.source_type as SourceType, trustScore: Number(r.trust_score),
      contentHash: (r.content_hash as string | null) ?? null,
      rawTextLen: Number(r.raw_text_len ?? 0), status: r.status as SourceStatus,
      note: (r.note as string | null) ?? null, createdAt: r.created_at as string,
    };
  }

  const sources = {
    upsert(input: {
      runId: string; conversationId: string; url: string; canonicalUrl: string; domain: string;
      title: string; sourceType: SourceType; trustScore: number; status: SourceStatus;
      publishedAt?: string | null; note?: string | null;
    }): SourceRecord {
      const existing = db
        .prepare('SELECT * FROM sources WHERE run_id = ? AND canonical_url = ?')
        .get(input.runId, input.canonicalUrl);
      if (existing) return mapSource(plain<Record<string, unknown>>(existing));
      const row = db.prepare('SELECT COALESCE(MAX(index_num), 0) AS max_index FROM sources WHERE run_id = ?').get(input.runId);
      const indexNum = Number(plain<{ max_index: number }>(row).max_index) + 1;
      const id = newId('src');
      const ts = nowIso();
      db.prepare(
        `INSERT INTO sources (id, run_id, conversation_id, index_num, url, canonical_url, domain, title,
          author, published_at, fetched_at, source_type, trust_score, content_hash, raw_text_len, status, note, created_at)
         VALUES (?,?,?,?,?,?,?,?,NULL,?,NULL,?,?,NULL,0,?,?,?)`,
      ).run(id, input.runId, input.conversationId, indexNum, input.url, input.canonicalUrl,
        input.domain, input.title, input.publishedAt ?? null, input.sourceType,
        input.trustScore, input.status, input.note ?? null, ts);
      return mapSource({
        id, run_id: input.runId, conversation_id: input.conversationId, index_num: indexNum,
        url: input.url, canonical_url: input.canonicalUrl, domain: input.domain, title: input.title,
        author: null, published_at: input.publishedAt ?? null, fetched_at: null,
        source_type: input.sourceType, trust_score: input.trustScore, content_hash: null,
        raw_text_len: 0, status: input.status, note: input.note ?? null, created_at: ts,
      });
    },
    update(id: string, patch: Partial<{
      title: string; author: string | null; publishedAt: string | null; fetchedAt: string | null;
      sourceType: SourceType; trustScore: number; contentHash: string | null;
      rawTextLen: number; status: SourceStatus; note: string | null;
    }>): void {
      const map: Record<string, string> = {
        title: 'title', author: 'author', publishedAt: 'published_at', fetchedAt: 'fetched_at',
        sourceType: 'source_type', trustScore: 'trust_score', contentHash: 'content_hash',
        rawTextLen: 'raw_text_len', status: 'status', note: 'note',
      };
      const fields: string[] = [];
      const values: (string | number | null)[] = [];
      for (const [key, column] of Object.entries(map)) {
        const value = (patch as Record<string, unknown>)[key];
        if (value !== undefined) { fields.push(`${column} = ?`); values.push(value as string | number | null); }
      }
      if (fields.length === 0) return;
      values.push(id);
      db.prepare(`UPDATE sources SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    },
    findByHash(runId: string, contentHash: string): SourceRecord | undefined {
      const row = db.prepare('SELECT * FROM sources WHERE run_id = ? AND content_hash = ?').get(runId, contentHash);
      return row ? mapSource(plain<Record<string, unknown>>(row)) : undefined;
    },
    listByRun(runId: string): SourceRecord[] {
      const rows = db.prepare('SELECT * FROM sources WHERE run_id = ? ORDER BY index_num ASC').all(runId);
      return plainAll<Record<string, unknown>>(rows).map(mapSource);
    },
    listByConversation(conversationId: string): SourceRecord[] {
      const rows = db
        .prepare('SELECT * FROM sources WHERE conversation_id = ? ORDER BY created_at ASC, index_num ASC')
        .all(conversationId);
      return plainAll<Record<string, unknown>>(rows).map(mapSource);
    },
    countByDomain(runId: string, domain: string): number {
      const r = db.prepare('SELECT COUNT(*) AS n FROM sources WHERE run_id = ? AND domain = ?').get(runId, domain);
      return Number(plain<{ n: number }>(r).n);
    },
  };

  const excerpts = {
    create(input: {
      sourceId: string; runId: string; text: string; startOffset: number; endOffset: number;
      claimKey?: string | null; extractedValue?: string | null;
    }): ExcerptRecord {
      const id = newId('exc');
      const ts = nowIso();
      db.prepare(
        'INSERT INTO excerpts (id, source_id, run_id, text, start_offset, end_offset, claim_key, extracted_value, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(id, input.sourceId, input.runId, input.text, input.startOffset, input.endOffset,
        input.claimKey ?? null, input.extractedValue ?? null, ts);
      return {
        id, sourceId: input.sourceId, runId: input.runId, text: input.text,
        startOffset: input.startOffset, endOffset: input.endOffset,
        claimKey: input.claimKey ?? null, extractedValue: input.extractedValue ?? null, createdAt: ts,
      };
    },
    listByRun(runId: string): ExcerptRecord[] {
      const rows = db.prepare('SELECT * FROM excerpts WHERE run_id = ? ORDER BY created_at ASC').all(runId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, sourceId: r.source_id as string, runId: r.run_id as string,
        text: r.text as string, startOffset: Number(r.start_offset), endOffset: Number(r.end_offset),
        claimKey: (r.claim_key as string | null) ?? null,
        extractedValue: (r.extracted_value as string | null) ?? null,
        createdAt: r.created_at as string,
      }));
    },
    listBySource(sourceId: string): ExcerptRecord[] {
      const rows = db.prepare('SELECT * FROM excerpts WHERE source_id = ? ORDER BY created_at ASC').all(sourceId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, sourceId, runId: r.run_id as string, text: r.text as string,
        startOffset: Number(r.start_offset), endOffset: Number(r.end_offset),
        claimKey: (r.claim_key as string | null) ?? null,
        extractedValue: (r.extracted_value as string | null) ?? null,
        createdAt: r.created_at as string,
      }));
    },
  };

  const citations = {
    createMany(items: Omit<Citation, 'id' | 'createdAt'>[]): Citation[] {
      const stmt = db.prepare(
        'INSERT INTO citations (id, message_id, run_id, source_id, excerpt_id, marker, claim_text, created_at) VALUES (?,?,?,?,?,?,?,?)',
      );
      const ts = nowIso();
      return items.map((item) => {
        const id = newId('cit');
        stmt.run(id, item.messageId, item.runId, item.sourceId, item.excerptId, item.marker, item.claimText, ts);
        return { ...item, id, createdAt: ts };
      });
    },
    listByMessage(messageId: string): Citation[] {
      const rows = db.prepare('SELECT * FROM citations WHERE message_id = ? ORDER BY marker ASC').all(messageId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, messageId, runId: r.run_id as string, sourceId: r.source_id as string,
        excerptId: (r.excerpt_id as string | null) ?? null, marker: Number(r.marker),
        claimText: (r.claim_text as string | null) ?? null, createdAt: r.created_at as string,
      }));
    },
  };

  const conflicts = {
    create(runId: string, claimKey: string, description: string, entries: ConflictEntry[]): Conflict {
      const id = newId('cfl');
      const ts = nowIso();
      db.prepare('INSERT INTO conflicts (id, run_id, claim_key, description, entries_json, created_at) VALUES (?,?,?,?,?,?)')
        .run(id, runId, claimKey, description, JSON.stringify(entries), ts);
      return { id, runId, claimKey, description, entries, createdAt: ts };
    },
    listByRun(runId: string): Conflict[] {
      const rows = db.prepare('SELECT * FROM conflicts WHERE run_id = ? ORDER BY created_at ASC').all(runId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, runId, claimKey: r.claim_key as string,
        description: r.description as string,
        entries: parseJson<ConflictEntry[]>(r.entries_json as string, []),
        createdAt: r.created_at as string,
      }));
    },
  };

  const usage = {
    record(input: { runId: string; kind: string; model: string; inputTokens: number; outputTokens: number; costMicroUsd: number }): void {
      db.prepare(
        'INSERT INTO usage_events (id, run_id, kind, model, input_tokens, output_tokens, cost_micro_usd, created_at) VALUES (?,?,?,?,?,?,?,?)',
      ).run(newId('usg'), input.runId, input.kind, input.model, input.inputTokens,
        input.outputTokens, input.costMicroUsd, nowIso());
      db.prepare('UPDATE runs SET cost_micro_usd = cost_micro_usd + ? WHERE id = ?')
        .run(input.costMicroUsd, input.runId);
    },
    listByRun(runId: string): UsageEvent[] {
      const rows = db.prepare('SELECT * FROM usage_events WHERE run_id = ? ORDER BY created_at ASC').all(runId);
      return plainAll<Record<string, unknown>>(rows).map((r) => ({
        id: r.id as string, runId, kind: r.kind as string, model: r.model as string,
        inputTokens: Number(r.input_tokens), outputTokens: Number(r.output_tokens),
        costMicroUsd: Number(r.cost_micro_usd), createdAt: r.created_at as string,
      }));
    },
    totalCost(runId: string): number {
      const r = db.prepare('SELECT COALESCE(SUM(cost_micro_usd),0) AS total FROM usage_events WHERE run_id = ?').get(runId);
      return Number(plain<{ total: number }>(r).total);
    },
  };

  return { db, users, conversations, messages, runs, steps, events, toolCalls, sources, excerpts, citations, conflicts, usage };
}

export type Repositories = ReturnType<typeof createRepositories>;

let repos: Repositories | undefined;

export function getRepositories(db?: Db): Repositories {
  if (db) return createRepositories(db);
  if (!repos) {
    repos = createRepositories(getDb());
    repos.users.ensureLocal();
  }
  return repos;
}

export function resetRepositories(): void {
  repos = undefined;
}
