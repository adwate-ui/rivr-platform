import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast.ts';
import { tokenValue } from './token-tree.ts';

function hex(path: string): string {
  const value = tokenValue(path);
  if (typeof value !== 'string') throw new Error(`${path} is not a colour`);
  return value;
}

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('composites a translucent foreground before measuring', () => {
    expect(contrastRatio('#FFFFFF00', '#000000')).toBeCloseTo(1, 5);
  });
});

describe('text contrast is at least 4.5:1', () => {
  it.each([
    ['cream on green', 'color.content', 'color.surface'],
    ['muted on green', 'color.contentMuted', 'color.surface'],
    ['cream on green-black', 'color.content', 'color.raised'],
    ['muted on green-black', 'color.contentMuted', 'color.raised'],
    ['gold (player money) on green', 'color.money', 'color.surface'],
    ['gold (player money) on green-black', 'color.money', 'color.raised'],
    ['text on the primary action', 'color.onAction', 'color.action'],
    ['text on an alert', 'color.onAlert', 'color.alert'],
    ['ink on a cream tile', 'color.onCream', 'color.cream'],
    ['muted ink on the website\'s cream bands', 'color.inkMuted', 'color.cream'],
    ['an accent on green-black', 'color.accent', 'color.raised'],
    ['an accent on a cream band, in green', 'color.green', 'color.cream'],
  ])('%s', (_name, foreground, background) => {
    expect(contrastRatio(hex(foreground), hex(background))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('non-text contrast is at least 3:1', () => {
  it('keeps the focus ring visible on green and on the gold action', () => {
    expect(contrastRatio(hex('color.focus'), hex('color.surface'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex('color.focus'), hex('color.raised'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the focus ring visible on the website\'s cream bands, where it is ink', () => {
    expect(contrastRatio(hex('color.ink'), hex('color.cream'))).toBeGreaterThanOrEqual(3);
  });

  it.each(['1', '2', '3', '4', '5', '6'])('chart colour %s reads on green', (series) => {
    expect(contrastRatio(hex(`color.chart.${series}`), hex('color.surface'))).toBeGreaterThanOrEqual(3);
  });
});
