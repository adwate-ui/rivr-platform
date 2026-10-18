// @ts-check
/**
 * Mutation testing for the money rules (.claude/rules/money.md): the score must stay at or above 80%.
 * Run with `pnpm --filter @rivr/domain exec stryker run`. Reports land in reports/, which git ignores.
 * Lanes add their rule folders (rake, callTime, tds, gst, markers, payouts) to `mutate`.
 *
 * Why the command runner: @stryker-mutator/vitest-runner 10.0.0 filters tests by "suite test" names,
 * but Vitest 5 names them "suite > test", so every filtered run skips its tests and every mutant
 * "survives". The command runner runs the whole suite per mutant in a fresh process, activating the
 * mutant through an environment variable. Slower, but the score is real.
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  testRunner: 'command',
  // Coverage is measured by the normal test run; inside Stryker's sandbox the injected mutant
  // switches lower the line count, so the coverage threshold would fail every run.
  commandRunner: { command: 'npx vitest run --bail=1 --reporter=dot --coverage.enabled=false' },
  coverageAnalysis: 'off',
  mutate: ['src/money/**/*.ts', 'src/ledger/**/*.ts', '!src/**/*.test.ts', '!src/**/index.ts'],
  thresholds: { high: 95, low: 85, break: 80 },
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
