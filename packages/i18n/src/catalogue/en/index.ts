/**
 * The catalogue: every message and so every message key. One file per namespace so lanes
 * add copy without editing each other's files; register a new namespace here.
 */
import { consoleApp, displayApp, driverApp, playerApp, tabletApp, webApp } from './apps.ts';
import { common } from './common.ts';
import { tv } from './tv.ts';
import { ui } from './ui.ts';

export const en = {
  common,
  ui,
  tv,
  player: playerApp,
  console: consoleApp,
  tablet: tabletApp,
  display: displayApp,
  driver: driverApp,
  web: webApp,
} as const;
