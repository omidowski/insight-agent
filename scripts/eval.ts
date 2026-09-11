import { runEvaluation } from '../lib/eval/runner';
import { formatReportMarkdown } from '../lib/eval/harness';

async function main() {
  process.env.DATABASE_PATH = ':memory:';
  process.env.RATE_LIMIT_ENABLED = 'false';
  process.env.LOG_LEVEL = 'error';
  process.env.RESPECT_ROBOTS = 'false';
  process.env.ALLOW_LOOPBACK_FETCH = '1';
  process.env.DOMAIN_RATE_LIMIT_MS = '0';

  console.log('Running Insight Agent Evaluation (Spec 41)...');
  const report = await runEvaluation();
  console.log('\n' + formatReportMarkdown(report));

  if (report.passedCases < report.totalCases) {
    console.error(`\nEvaluation failed: ${report.passedCases}/${report.totalCases} passed.`);
    process.exit(1);
  } else {
    console.log('\nEvaluation passed successfully.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
