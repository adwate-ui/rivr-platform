/**
 * The English catalogue, the source of every message key. One file per namespace so
 * lanes add copy without editing each other's files; register a new namespace here
 * and in ../hi/index.ts.
 */
import { common } from './common.ts';
import { tv } from './tv.ts';
import { ui } from './ui.ts';

export const en = {
  common,
  ui,
  tv,
} as const;
