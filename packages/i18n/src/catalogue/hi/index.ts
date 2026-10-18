/** The Hindi catalogue. It must match the English one key for key; the type enforces it. */
import type { Catalogue } from '../types.ts';
import { common } from './common.ts';
import { tv } from './tv.ts';
import { ui } from './ui.ts';

export const hi: Catalogue = {
  common,
  ui,
  tv,
};
