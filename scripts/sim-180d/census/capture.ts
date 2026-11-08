/** One screen captured: a full-page picture, its text, errors, failed requests, axe, speed and layout facts. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { AppName } from '../src/catalogue/types.ts';
import type { Capture } from '../src/census/checks.ts';
import { roleOf, type Expect, type Person } from '../src/census/plan.ts';
import { REPO_ROOT } from '../src/paths.ts';
import { AXE_RUN, axeSchema, LAYOUT_FACTS, layoutSchema, LCP_PROBE } from './inpage.ts';

// axe-core is already a dependency of packages/ui; nothing new is added.
const AXE_PATH = createRequire(join(REPO_ROOT, 'packages', 'ui', 'package.json')).resolve('axe-core');
const REFUSAL = /Not in your role|is switched off|Only a super admin|does not allow this|are for managers/;

export interface Seen {
  consoleErrors: string[];
  warnings: string[];
  failedRequests: string[];
}

const short = (url: string): string => url.replace(/^https?:\/\/[^/]+/, '').slice(0, 160);

/** Starts recording a page's console errors and warnings and failed requests, and its largest paint. */
export async function watch(page: Page): Promise<Seen> {
  const seen: Seen = { consoleErrors: [], warnings: [], failedRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push(message.text().slice(0, 300));
    if (message.type() === 'warning') seen.warnings.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => seen.consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`));
  page.on('response', (response) => {
    if (response.status() >= 400) seen.failedRequests.push(`${response.request().method()} ${short(response.url())} ${String(response.status())}`);
  });
  page.on('requestfailed', (request) => {
    const why = request.failure()?.errorText ?? 'failed';
    // A request the page itself cancelled as it moved on is no failure.
    if (why !== 'net::ERR_ABORTED') seen.failedRequests.push(`${request.method()} ${short(request.url())} ${why}`);
  });
  await page.addInitScript(LCP_PROBE);
  return seen;
}

/** What the person met: the sign-in screen, the console's refusal, another address, or the screen itself. */
export function outcomeOf(asked: string, landed: string, text: string): Expect {
  if (/\/sign-in(\?|$)/.test(landed) && !/\/sign-in(\?|$)/.test(asked)) return 'sign_in';
  if (REFUSAL.test(text)) return 'refused';
  const strip = (address: string): string => address.replace(/\/$/, '') || '/';
  return strip(landed) === strip(asked) ? 'open' : 'moved';
}

export interface Shot {
  app: AppName;
  person: Person;
  /** The address asked for, with any tab the census then clicked after a '#'. */
  path: string;
  size: string;
  checkpoint: string;
  expect: Expect;
}

export interface CaptureRecord extends Capture {
  person: Person;
  landed: string;
  title: string;
  warnings: string[];
  loadMs: number | null;
  scriptBytes: number;
  axeTargets: Record<string, string[]>;
  shot: string;
}

const slug = (text: string): string => text.replaceAll(/[^a-zA-Z0-9]+/g, '_').replaceAll(/^_|_$/g, '') || 'home';

/** Captures the page as it stands into `dir`: <app>/<size>/<person>/<slug>.png and .json. */
export async function capture(page: Page, shot: Shot, seen: Seen, dir: string): Promise<CaptureRecord> {
  const folder = join(dir, shot.app, shot.size, shot.person);
  mkdirSync(folder, { recursive: true });
  const file = join(folder, slug(shot.path));
  await page.screenshot({ path: `${file}.png`, fullPage: true });
  const layout = layoutSchema.parse(await page.evaluate(LAYOUT_FACTS));
  await page.addScriptTag({ path: AXE_PATH });
  const axe = axeSchema.parse(await page.evaluate(AXE_RUN));
  const landed = new URL(page.url()).pathname + new URL(page.url()).search;
  const record: CaptureRecord = {
    app: shot.app, role: roleOf(shot.person), person: shot.person, path: shot.path, size: shot.size,
    checkpoint: shot.checkpoint, expect: shot.expect, outcome: outcomeOf(shot.path.split('#')[0] ?? shot.path, landed, layout.text), landed,
    text: layout.text, title: layout.title, consoleErrors: [...seen.consoleErrors], warnings: [...seen.warnings],
    failedRequests: [...seen.failedRequests], axe: axe.map(({ targets: _targets, ...rest }) => rest),
    axeTargets: Object.fromEntries(axe.map((violation) => [violation.id, violation.targets])),
    lcpMs: layout.lcpMs, loadMs: layout.loadMs, scriptBytes: layout.scriptBytes, overflowX: layout.overflowX,
    tinyTargets: layout.tinyTargets, smallTargets: layout.smallTargets, clipped: layout.clipped, fallbackFonts: layout.fallbackFonts,
    shot: `${file}.png`,
  };
  writeFileSync(`${file}.json`, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
