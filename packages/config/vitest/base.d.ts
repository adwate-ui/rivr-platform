import type { UserConfig } from 'vitest/config';

/**
 * Shared Vitest settings. A package that renders React passes `environment: 'jsdom'`; a package
 * with a coverage target passes `coverageLines` (percent).
 */
export function vitestConfig(options?: {
  environment?: 'node' | 'jsdom';
  setupFiles?: string[];
  coverageLines?: number;
  /** Milliseconds per test; default 5000. Only for packages whose tests are deliberately heavy. */
  testTimeout?: number;
}): UserConfig;
