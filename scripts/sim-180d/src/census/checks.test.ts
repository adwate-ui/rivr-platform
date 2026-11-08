import { describe, expect, it } from 'vitest';
import { checkCapture, type Capture } from './checks.ts';

const CLEAN: Capture = {
  app: 'player',
  role: 'member',
  path: '/',
  size: '390x844',
  checkpoint: 'night-30',
  text: 'Home\nTable 2 · 25/50 · Min buy-in ₹5,000\nJoin',
  consoleErrors: [],
  failedRequests: [],
  axe: [],
  lcpMs: 1200,
  overflowX: false,
  tinyTargets: [],
  smallTargets: [],
  expect: 'open',
  outcome: 'open',
  clipped: [],
  fallbackFonts: [],
  offCentre: [],
  misaligned: [],
};

const checks = (change: Partial<Capture>) => checkCapture({ ...CLEAN, ...change }).map((flag) => flag.check);

describe('checkCapture', () => {
  it('flags a role that opens a screen it should be refused as P0, and one refused a screen it should open as P1', () => {
    const opened = checkCapture({ ...CLEAN, app: 'console', role: 'service', text: 'Members', expect: 'refused', outcome: 'open' });
    expect(opened.map((flag) => [flag.check, flag.severity])).toEqual([['access_mismatch', 'P0']]);
    const refused = checkCapture({ ...CLEAN, app: 'console', role: 'floor', text: 'Members', expect: 'open', outcome: 'refused' });
    expect(refused.map((flag) => [flag.check, flag.severity])).toEqual([['access_mismatch', 'P1']]);
    expect(checks({ expect: 'moved', outcome: 'refused' })).toEqual([]);
  });

  it('flags a photo off-centre in its frame, or leaving the frame showing', () => {
    expect(checks({ offCentre: ['Your photo: gaps L0 R3.5 T0 B0 px in a 62x78 frame, showing rgb(16, 48, 36)'] })).toEqual(['off_centre']);
  });

  it('flags a near miss in alignment as polish', () => {
    expect(checkCapture({ ...CLEAN, misaligned: ['Mobile number: left edges 16 and 18 px'] }).map((flag) => [flag.check, flag.severity])).toEqual([['misaligned', 'P3']]);
  });

  it('flags targets under 24 px as WCAG AA, and under 44 px as polish', () => {
    expect(checkCapture({ ...CLEAN, tinyTargets: ['×'], smallTargets: ['Back'] }).map((flag) => [flag.check, flag.severity])).toEqual([
      ['tiny_targets', 'P2'],
      ['small_targets', 'P3'],
    ]);
  });

  it('passes a clean screen, with the minimum buy-in as its only ₹', () => {
    expect(checkCapture(CLEAN)).toEqual([]);
  });

  it('flags any other ₹ on the player app, and any ₹ on a console', () => {
    expect(checks({ text: 'Your balance ₹12,000' })).toEqual(['rupee_on_player']);
    expect(checks({ app: 'console', role: 'floor', text: 'Min buy-in ₹5,000' })).toEqual(['rupee_on_console']);
  });

  it('flags a string key shown as text, but not a web address', () => {
    expect(checks({ text: 'console.rail.items.waitlist' })).toEqual(['raw_string_key']);
    expect(checks({ text: 'Visit app.rivrpoker.com' })).toEqual([]);
  });

  it.each(['Seat undefined', 'NaN chips', '[object Object]', 'Lorem ipsum', 'TODO: copy'])('flags placeholder text: %s', (text) => {
    expect(checks({ text })).toEqual(['placeholder_text']);
  });

  it('flags errors, failed requests and a slow paint', () => {
    expect(checks({ consoleErrors: ['TypeError: x'], failedRequests: ['POST /rest/v1/rpc/x 500'], lcpMs: 4000 })).toEqual([
      'console_error',
      'failed_request',
      'slow_lcp',
    ]);
  });

  it('ranks serious accessibility failures above minor ones', () => {
    const flags = checkCapture({
      ...CLEAN,
      axe: [
        { id: 'color-contrast', impact: 'serious', nodes: 3, help: 'Contrast' },
        { id: 'region', impact: 'moderate', nodes: 1, help: 'Landmarks' },
      ],
    });
    expect(flags.map((flag) => [flag.check, flag.severity, flag.detail])).toEqual([
      ['axe:color-contrast', 'P1', 'Contrast (3 elements)'],
      ['axe:region', 'P2', 'Landmarks (1 element)'],
    ]);
  });

  it('flags layout problems', () => {
    expect(checks({ overflowX: true, smallTargets: ['Back'], clipped: ['Table 12'], fallbackFonts: ['Inter'] })).toEqual([
      'overflow_x',
      'small_targets',
      'clipped_text',
      'fallback_font',
    ]);
  });
});
