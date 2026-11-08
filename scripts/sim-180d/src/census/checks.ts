/** The census's automatic checks on one captured screen. Each flag is a lead for the review, not yet a finding. */
import type { AppName, Role } from '../catalogue/types.ts';
import type { Lens, Severity } from '../report/types.ts';

export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  nodes: number;
  help: string;
}

/** What census/capture.ts records for one screen, as one role, at one size and checkpoint. */
export interface Capture {
  app: AppName;
  role: Role;
  path: string;
  size: string;
  checkpoint: string;
  text: string;
  consoleErrors: string[];
  /** `METHOD url status`, for responses of 400 and up and requests that never answered. */
  failedRequests: string[];
  axe: AxeViolation[];
  lcpMs: number | null;
  /** Horizontal scrolling on the page itself. */
  overflowX: boolean;
  /** Clickable elements smaller than 44 × 44 px, by their text or label. */
  smallTargets: string[];
  /** Text cut off by its box. */
  clipped: string[];
  /** Font families that fell back instead of loading. */
  fallbackFonts: string[];
}

export interface Flag {
  check: string;
  lens: Lens;
  severity: Severity;
  detail: string;
}

const LCP_BUDGET_MS = 2500;
// An i18n key shown as text: console.rail.items.waitlist. A host name such as app.rivrpoker.com is not one.
const RAW_KEY = /\b[a-z]+(?:\.[a-z][a-zA-Z]+){2,}\b/g;
const HOST_ENDING = /\.(?:com|in|dev|app|org|net|io)$/;
const PLACEHOLDER = /\bundefined\b|\bNaN\b|\[object |lorem ipsum|\bTODO\b/i;
// The one rupee figure the player app shows (owner, 8 Nov): the minimum buy-in.
const MIN_BUY_IN = /Min buy-in ₹[\d,]+/g;

function textFlags(capture: Capture): Flag[] {
  const flags: Flag[] = [];
  if (capture.app === 'console' && capture.text.includes('₹')) {
    flags.push({ check: 'rupee_on_console', lens: 'function', severity: 'P1', detail: 'a ₹ figure on a console screen (decision 0284)' });
  }
  if (capture.app === 'player' && capture.text.replace(MIN_BUY_IN, '').includes('₹')) {
    flags.push({ check: 'rupee_on_player', lens: 'function', severity: 'P1', detail: 'a ₹ figure other than "Min buy-in ₹…"' });
  }
  const keys = [...capture.text.matchAll(RAW_KEY)].map((match) => match[0]).filter((key) => !HOST_ENDING.test(key));
  if (keys.length > 0) flags.push({ check: 'raw_string_key', lens: 'copy', severity: 'P1', detail: [...new Set(keys)].join(', ') });
  const placeholder = PLACEHOLDER.exec(capture.text);
  if (placeholder) flags.push({ check: 'placeholder_text', lens: 'copy', severity: 'P1', detail: placeholder[0] });
  return flags;
}

function axeFlags(capture: Capture): Flag[] {
  return capture.axe.map((violation) => ({
    check: `axe:${violation.id}`,
    lens: 'a11y',
    severity: violation.impact === 'critical' || violation.impact === 'serious' ? 'P1' : 'P2',
    detail: `${violation.help} (${violation.nodes} element${violation.nodes === 1 ? '' : 's'})`,
  }));
}

function layoutFlags(capture: Capture): Flag[] {
  const flags: Flag[] = [];
  if (capture.overflowX) flags.push({ check: 'overflow_x', lens: 'design', severity: 'P2', detail: 'the page scrolls sideways' });
  if (capture.smallTargets.length > 0) flags.push({ check: 'small_targets', lens: 'a11y', severity: 'P2', detail: capture.smallTargets.join(', ') });
  if (capture.clipped.length > 0) flags.push({ check: 'clipped_text', lens: 'design', severity: 'P3', detail: capture.clipped.join(', ') });
  if (capture.fallbackFonts.length > 0) flags.push({ check: 'fallback_font', lens: 'design', severity: 'P2', detail: capture.fallbackFonts.join(', ') });
  return flags;
}

function runtimeFlags(capture: Capture): Flag[] {
  const flags: Flag[] = [];
  if (capture.consoleErrors.length > 0) flags.push({ check: 'console_error', lens: 'function', severity: 'P1', detail: capture.consoleErrors.join(' | ') });
  if (capture.failedRequests.length > 0) flags.push({ check: 'failed_request', lens: 'function', severity: 'P1', detail: capture.failedRequests.join(' | ') });
  if (capture.lcpMs !== null && capture.lcpMs > LCP_BUDGET_MS) {
    flags.push({ check: 'slow_lcp', lens: 'speed', severity: 'P2', detail: `largest paint at ${Math.round(capture.lcpMs)} ms on throttled 4G` });
  }
  return flags;
}

export function checkCapture(capture: Capture): Flag[] {
  return [...runtimeFlags(capture), ...textFlags(capture), ...axeFlags(capture), ...layoutFlags(capture)];
}
