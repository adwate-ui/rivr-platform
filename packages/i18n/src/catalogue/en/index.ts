/**
 * The catalogue: every message and so every message key. One file per namespace so lanes
 * add copy without editing each other's files; register a new namespace here.
 */
import { consoleApp, displayApp, playerApp, tabletApp, webApp } from './apps.ts';
import { common } from './common.ts';
import { alerts } from './alerts.ts';
import { documents } from './documents.ts';
import { playerBonus } from './playerBonus.ts';
import { push } from './push.ts';
import { tv } from './tv.ts';
import { ui } from './ui.ts';

export const en = {
  common,
  ui,
  tv,
  alerts,
  documents,
  playerBonus,
  push,
  player: playerApp,
  console: consoleApp,
  tablet: tabletApp,
  display: displayApp,
  web: webApp,
} as const;
