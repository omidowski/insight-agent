/** Domänentypen und Enums — Single Source of Truth (Spec 05). */
import { z } from 'zod';

export const taskTypeSchema = z.enum([
  'conversation', 'knowledge_question', 'web_lookup', 'deep_research', 'comparison',
  'document_analysis', 'data_analysis', 'report_generation', 'multi_step_task', 'unsafe_or_refused',
]);
export type TaskType = z.infer<typeof taskTypeSchema>;

export const runStatusSchema = z.enum([
  'idle', 'routing', 'planning', 'searching', 'reading_sources', 'extracting', 'comparing',
  'synthesizing', 'completed', 'failed', 'cancelled', 'paused',
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const stepStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'skipped']);
export type StepStatus = z.infer<typeof stepStatusSchema>;

export const sourceTypeSchema = z.enum(['primary', 'secondary', 'aggregator', 'social', 'unknown']);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const sourceStatusSchema = z.enum(['discovered', 'fetched', 'failed', 'skipped']);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageStatusSchema = z.enum(['complete', 'streaming', 'failed', 'cancelled']);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const toolNameSchema = z.enum([
  'web_search', 'open_url', 'extract_content', 'search_in_page', 'calculator', 'datetime', 'vector_search',
]);
export type ToolName = z.infer<typeof toolNameSchema>;

export const runModeSchema = z.enum([
  'auto',
  'chat',
  'research',
  'deep_research',
  'web_lookup',
  'comparison',
  'data_analysis',
  'report_generation',
]);
export type RunMode = z.infer<typeof runModeSchema>;

export const stopReasonSchema = z.enum(['answered', 'budget', 'saturation', 'cancelled', 'error']);
export type StopReason = z.infer<typeof stopReasonSchema>;

export const researchDepthSchema = z.enum(['quick', 'standard', 'deep']);
export type ResearchDepth = z.infer<typeof researchDepthSchema>;

export const researchTimeframeSchema = z.enum(['all', 'day', 'week', 'month', 'year']);
export type ResearchTimeframe = z.infer<typeof researchTimeframeSchema>;

export const researchOutputFormatSchema = z.enum([
  'standard', 'detailed_report', 'comparison_table', 'bullet_points',
]);
export type ResearchOutputFormat = z.infer<typeof researchOutputFormatSchema>;

export interface ResearchOptions {
  depth?: ResearchDepth;
  timeframe?: ResearchTimeframe;
  focusDomains?: string[];
  excludeDomains?: string[];
  aspects?: string;
  outputFormat?: ResearchOutputFormat;
}

export interface RunBudgets {
  maxIterations: number;
  maxSearches: number;
  maxSources: number;
  maxWallClockMs: number;
  maxInputTokens: number;
  maxCostMicroUsd: number;
  maxToolCalls: number;
}

export interface BudgetUsage {
  iterations: number;
  searches: number;
  sources: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  startedAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  runId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanStep {
  id: string;
  seq: number;
  title: string;
  question: string;
  dependsOn: string[];
  status: StepStatus;
  result?: StepResult;
}

export interface ExtractionItem {
  claimKey: string;
  label: string;
  value: string;
  excerpt: string;
  sourceId?: string;
  confidence: number;
}

export interface StepResult {
  stepId: string;
  answer: string;
  sourceIds: string[];
  items: ExtractionItem[];
  confidence: number;
  note?: string;
}

export interface Run {
  id: string;
  conversationId: string;
  userId: string;
  requestMessageId: string;
  responseMessageId: string | null;
  taskType: TaskType;
  confidence: number;
  status: RunStatus;
  plan: PlanStep[];
  currentStepId: string | null;
  budgets: RunBudgets;
  usage: BudgetUsage;
  costMicroUsd: number;
  error: { code: string; userMessage: string } | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  /** Vom Nutzer gewähltes Modell für diesen Run (null = Standard). */
  modelOverride: string | null;
  /** Vom Nutzer gewählte Recherche-Optionen (null = Standard). */
  researchOptions?: ResearchOptions | null;
}

export interface SourceRecord {
  id: string;
  runId: string;
  conversationId: string;
  indexNum: number;
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
  sourceType: SourceType;
  trustScore: number;
  contentHash: string | null;
  rawTextLen: number;
  status: SourceStatus;
  note: string | null;
  createdAt: string;
}

export interface ExcerptRecord {
  id: string;
  sourceId: string;
  runId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  claimKey: string | null;
  extractedValue: string | null;
  createdAt: string;
}

export interface Citation {
  id: string;
  messageId: string;
  runId: string;
  sourceId: string;
  excerptId: string | null;
  marker: number;
  claimText: string | null;
  createdAt: string;
}

export interface ConflictEntry {
  sourceId: string;
  index: number;
  value: string;
  trustScore: number;
}

export interface Conflict {
  id: string;
  runId: string;
  claimKey: string;
  description: string;
  entries: ConflictEntry[];
  createdAt: string;
}

export interface ToolCallRecord {
  id: string;
  runId: string;
  stepId: string | null;
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  resultSummary: string | null;
  errorCode: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface UsageEvent {
  id: string;
  runId: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  createdAt: string;
}

export interface RouteDecision {
  taskType: TaskType;
  confidence: number;
  summary: string;
  clarificationNeeded: boolean;
  allowedTools: ToolName[];
  showActivity: boolean;
  budgets: RunBudgets;
  needsResearch: boolean;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  rank: number;
  seen?: boolean;
}
