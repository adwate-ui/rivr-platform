// @ts-check
/**
 * Shared Vitest settings. A package that renders React passes `environment: 'jsdom'`. A package
 * with a coverage target (.claude/rules/testing.md: domain 95%, db and adapters 80%) passes
 * `coverageLines`, and its tests fail when line coverage falls below it.
 */
import { defineConfig } from 'vitest/config';

/**
 * @param {{ environment?: 'node' | 'jsdom', setupFiles?: string[], coverageLines?: number, testTimeout?: number }} [options]
 */
export function vitestConfig(options = {}) {
  const { coverageLines } = options;
  return defineConfig({
    test: {
      environment: options.environment ?? 'node',
      setupFiles: options.setupFiles ?? [],
      testTimeout: options.testTimeout ?? 5000,
      include: ['**/*.test.{ts,tsx,js}'],
      exclude: ['**/node_modules/**', '**/dist/**'],
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
