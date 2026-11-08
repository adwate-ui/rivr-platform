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
  /** Clickable elements under 24 × 24 px (WCAG 2.2 AA, 2.5.8), by their text or label. */
  tinyTargets: string[];
  /** Clickable elements from 24 to 44 px (below the 44 px touch size), by their text or label. */
  smallTargets: string[];
  /** What the person should see (src/census/plan.ts) and what they saw. */
  expect: string;
  outcome: string;
  /** Text cut off by its box. */
  clipped: string[];
  /** Font families that fell back instead of loading. */
  fallbackFonts: string[];
  /** Photos, avatars and icons that should fill their frame but sit off-centre or leave the frame's colour showing. */
  offCentre: string[];
  /** Near misses in alignment: siblings' left edges 1 to 4 px apart, or a centred box off its parent's centre. */
  misaligned: string[];
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
  if (capture.tinyTargets.length > 0) flags.push({ check: 'tiny_targets', lens: 'a11y', severity: 'P2', detail: capture.tinyTargets.join(', ') });
  if (capture.smallTargets.length > 0) flags.push({ check: 'small_targets', lens: 'a11y', severity: 'P3', detail: capture.smallTargets.join(', ') });
  if (capture.clipped.length > 0) flags.push({ check: 'clipped_text', lens: 'design', severity: 'P3', detail: capture.clipped.join(', ') });
  if (capture.fallbackFonts.length > 0) flags.push({ check: 'fallback_font', lens: 'design', severity: 'P2', detail: capture.fallbackFonts.join(', ') });
  if (capture.offCentre.length > 0) flags.push({ check: 'off_centre', lens: 'design', severity: 'P2', detail: capture.offCentre.join(' | ') });
  if (capture.misaligned.length > 0) flags.push({ check: 'misaligned', lens: 'design', severity: 'P3', detail: capture.misaligned.join(' | ') });
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

// A screen a role should be refused but opens is a privacy failure; one it should open but is refused blocks them.
function accessFlags(capture: Capture): Flag[] {
  if (capture.expect === capture.outcome || capture.expect === 'moved') return [];
  const opened = capture.outcome === 'open';
  return [{ check: 'access_mismatch', lens: opened ? 'security' : 'function', severity: opened ? 'P0' : 'P1', detail: `expected ${capture.expect}, saw ${capture.outcome}` }];
}

export function checkCapture(capture: Capture): Flag[] {
  return [...accessFlags(capture), ...runtimeFlags(capture), ...textFlags(capture), ...axeFlags(capture), ...layoutFlags(capture)];
}
