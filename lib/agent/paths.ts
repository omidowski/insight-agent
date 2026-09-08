/** Pfadkonfiguration je Task-Typ (Spec 13, FR-13-04). */
import type { RunBudgets, TaskType, ToolName } from '@/lib/contracts/domain';
import type { AppConfig } from '@/lib/config/env';

export interface PathConfig {
  allowedTools: ToolName[];
  showActivity: boolean;
  needsResearch: boolean;
  model: 'fast' | 'main';
  budgetScale: number;
}

const RESEARCH_TOOLS: ToolName[] = ['web_search', 'open_url', 'extract_content', 'search_in_page'];
const FULL_TOOLS: ToolName[] = [...RESEARCH_TOOLS, 'calculator', 'datetime'];

export const PATHS: Record<TaskType, PathConfig> = {
  conversation: { allowedTools: [], showActivity: false, needsResearch: false, model: 'main', budgetScale: 0 },
  knowledge_question: { allowedTools: [], showActivity: false, needsResearch: false, model: 'main', budgetScale: 0 },
  unsafe_or_refused: { allowedTools: [], showActivity: false, needsResearch: false, model: 'fast', budgetScale: 0 },
  web_lookup: { allowedTools: RESEARCH_TOOLS, showActivity: true, needsResearch: true, model: 'main', budgetScale: 0.35 },
  deep_research: { allowedTools: FULL_TOOLS, showActivity: true, needsResearch: true, model: 'main', budgetScale: 1 },
  comparison: { allowedTools: FULL_TOOLS, showActivity: true, needsResearch: true, model: 'main', budgetScale: 1 },
  multi_step_task: { allowedTools: FULL_TOOLS, showActivity: true, needsResearch: true, model: 'main', budgetScale: 1 },
  report_generation: { allowedTools: FULL_TOOLS, showActivity: true, needsResearch: true, model: 'main', budgetScale: 1 },
  document_analysis: { allowedTools: FULL_TOOLS, showActivity: true, needsResearch: true, model: 'main', budgetScale: 0.6 },
  data_analysis: { allowedTools: ['calculator', 'datetime', ...RESEARCH_TOOLS], showActivity: true, needsResearch: true, model: 'main', budgetScale: 0.6 },
};

export function budgetsFor(taskType: TaskType, config: AppConfig): RunBudgets {
  const path = PATHS[taskType];
  const base = config.defaultBudgets;
  if (!path.needsResearch) {
    return {
      maxIterations: 0, maxSearches: 0, maxSources: 0,
      maxWallClockMs: Math.min(base.maxWallClockMs, 60000),
      maxInputTokens: base.maxInputTokens,
      maxCostMicroUsd: base.maxCostMicroUsd,
      maxToolCalls: 0,
    };
  }
  const scale = path.budgetScale;
  return {
    maxIterations: Math.max(1, Math.round(base.maxIterations * scale)),
    maxSearches: Math.max(2, Math.round(base.maxSearches * scale)),
    maxSources: Math.max(3, Math.round(base.maxSources * scale)),
    maxWallClockMs: base.maxWallClockMs,
    maxInputTokens: base.maxInputTokens,
    maxCostMicroUsd: base.maxCostMicroUsd,
    maxToolCalls: Math.max(6, Math.round(base.maxToolCalls * scale)),
  };
}
