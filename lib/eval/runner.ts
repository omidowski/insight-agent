/**
 * Executes evaluation cases deterministically using test doubles and fixture server.
 */
import { freshRepos } from '@/tests/helpers/db';
import { startFixtureServer } from '@/tests/helpers/fixture-server';
import { fakeLlm, fakeSearch } from '@/tests/helpers/providers';
import { executeRun } from '@/lib/agent/orchestrator';
import { getConfig, resetConfig } from '@/lib/config/env';
import { budgetsFor } from '@/lib/agent/paths';
import { LOCAL_USER_ID } from '@/lib/db/repositories';
import {
  GOLDEN_SET,
  computeReport,
  type EvalCaseResult,
  type EvalReport,
  type GoldenEvalCase,
} from './harness';

export async function runEvaluation(cases: GoldenEvalCase[] = GOLDEN_SET): Promise<EvalReport> {
  resetConfig();
  const server = await startFixtureServer();
  const results: EvalCaseResult[] = [];

  try {
    for (const testCase of cases) {
      const repos = freshRepos();
      const config = getConfig();
      const conversation = repos.conversations.create(LOCAL_USER_ID);
      const userMessage = repos.messages.create(conversation.id, 'user', testCase.prompt, 'complete');
      const provisionalType = testCase.mode === 'chat' ? 'conversation' : 'deep_research';
      const run = repos.runs.create({
        conversationId: conversation.id,
        userId: LOCAL_USER_ID,
        requestMessageId: userMessage.id,
        taskType: provisionalType,
        budgets: budgetsFor(provisionalType, config),
      });

      const started = Date.now();
      let error: string | undefined;

      try {
        await executeRun({
          runId: run.id,
          mode: testCase.mode,
          repos,
          config,
          llm: fakeLlm(),
          search: fakeSearch(server.origin),
        });
      } catch (err) {
        error = (err as Error).message;
      }

      const durationMs = Date.now() - started;
      const completedRun = repos.runs.get(run.id);
      const sources = repos.sources.listByRun(run.id).filter((s) => s.status === 'fetched');
      const uniqueDomains = new Set(sources.map((s) => s.domain)).size;
      const excerpts = repos.excerpts.listByRun(run.id);
      const citations = completedRun?.responseMessageId
        ? repos.citations.listByMessage(completedRun.responseMessageId)
        : [];
      const answer = completedRun?.responseMessageId
        ? repos.messages.get(completedRun.responseMessageId)?.content ?? ''
        : '';

      const lowerAnswer = answer.toLowerCase();
      const matchedKeywords = testCase.expectedKeywords.filter((k) =>
        lowerAnswer.includes(k.toLowerCase()),
      );
      const missingKeywords = testCase.expectedKeywords.filter(
        (k) => !lowerAnswer.includes(k.toLowerCase()),
      );

      const hasSources = sources.length >= testCase.minSources;
      const hasCitations = citations.length >= testCase.minCitations;
      const hasKeywords = missingKeywords.length === 0;
      const passed =
        !error &&
        completedRun?.status === 'completed' &&
        hasSources &&
        hasCitations &&
        hasKeywords;

      results.push({
        id: testCase.id,
        title: testCase.title,
        passed,
        taskType: completedRun?.taskType ?? provisionalType,
        durationMs,
        costMicroUsd: completedRun?.costMicroUsd ?? 0,
        sourceCount: sources.length,
        uniqueDomains,
        citationCount: citations.length,
        excerptCount: excerpts.length,
        matchedKeywords,
        missingKeywords,
        error,
      });
    }
  } finally {
    await server.close();
  }

  return computeReport(results);
}
