import type { UserConfig } from 'vitest/config';

/** Shared Vitest settings. A package that renders React passes `environment: 'jsdom'`. */
export function vitestConfig(options?: { environment?: 'node' | 'jsdom'; setupFiles?: string[] }): UserConfig;
