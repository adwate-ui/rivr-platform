// @ts-check
/**
 * Shared Vitest settings. A package that renders React passes `environment: 'jsdom'`. A package
 * with a coverage target (.claude/rules/testing.md: domain 95%, db and adapters 80%) passes
 * `coverageLines`, and its tests fail when line coverage falls below it.
 */
import { defineConfig } from 'vitest/config';

// A screen test that types into a form takes 2 to 5 seconds, and more on a loaded machine or runner,
// so it gets 15 seconds before it counts as hung (decision 0103). Other tests keep Vitest's 5.
const JSDOM_TIMEOUT = 15_000;

/**
 * @param {{ environment?: 'node' | 'jsdom', setupFiles?: string[], coverageLines?: number, testTimeout?: number }} [options]
 */
export function vitestConfig(options = {}) {
  const { coverageLines } = options;
  const environment = options.environment ?? 'node';
  return defineConfig({
    test: {
      environment,
      setupFiles: options.setupFiles ?? [],
      testTimeout: options.testTimeout ?? (environment === 'jsdom' ? JSDOM_TIMEOUT : 5000),
      include: ['**/*.test.{ts,tsx,js}'],
      // A Stryker run cut short leaves its sandbox, a stale copy of the tests, under .stryker-tmp; never collect it.
      exclude: ['**/node_modules/**', '**/dist/**', '**/.stryker-tmp/**'],
      ...(coverageLines === undefined
        ? {}
        : {
            coverage: {
              enabled: true,
              provider: 'v8',
              reporter: ['text-summary', 'json-summary'],
              include: ['src/**'],
              exclude: ['src/**/*.test.{ts,tsx}', 'src/**/index.ts'],
              thresholds: { lines: coverageLines },
            },
          }),
    },
  });
}
