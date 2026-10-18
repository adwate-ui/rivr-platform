// @ts-check
/** Shared Vitest settings. A package that renders React passes `environment: 'jsdom'`. */
import { defineConfig } from 'vitest/config';

/**
 * @param {{ environment?: 'node' | 'jsdom', setupFiles?: string[] }} [options]
 */
export function vitestConfig(options = {}) {
  return defineConfig({
    test: {
      environment: options.environment ?? 'node',
      setupFiles: options.setupFiles ?? [],
      include: ['**/*.test.{ts,tsx,js}'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  });
}
