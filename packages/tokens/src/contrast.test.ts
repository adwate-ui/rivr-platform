import { describe, expect, it } from 'vitest';
import { contrastRatio, flatten } from './contrast.ts';
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
    ['danger text on green (console v3)', 'color.danger', 'color.surface'],
    ['danger text on green-black (console v3)', 'color.danger', 'color.raised'],
  ])('%s', (_name, foreground, background) => {
    expect(contrastRatio(hex(foreground), hex(background))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('text on a tinted fill is at least 4.5:1 (F-026, F-200)', () => {
  it.each([
    ['cream on the selected tint over green', 'color.content', 'color.selected', 'color.surface'],
    ['cream on the selected tint over green-black', 'color.content', 'color.selected', 'color.raised'],
    ['muted on the selected tint over green-black, as a PickList has it', 'color.contentMuted', 'color.selected', 'color.raised'],
    ['cream on the subtle fill over green', 'color.content', 'color.subtle', 'color.surface'],
    ['cream on the gold tint over green, a member\u2019s usual', 'color.content', 'color.goldTint', 'color.surface'],
    ['cream on the red tint over green, the member\u2019s ID check on Tonight', 'color.content', 'color.redTint', 'color.surface'],
    ['the danger red on the red tint over green, the ID check\u2019s eyebrow', 'color.danger', 'color.redTint', 'color.surface'],
  ])('%s', (_name, text, tint, ground) => {
    expect(contrastRatio(hex(text), flatten(hex(tint), hex(ground)))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('a chosen state is told from what is around it, at least 3:1 (F-019)', () => {
  it.each([
    ['a chosen chip\u2019s gold edge on its tint, over green', 'color.gold', 'color.selected', 'color.surface'],
    ['a chosen segment\u2019s gold edge on the cream track, over green', 'color.gold', 'color.creamTrack', 'color.surface'],
  ])('%s', (_name, edge, tint, ground) => {
    expect(contrastRatio(hex(edge), flatten(hex(tint), hex(ground)))).toBeGreaterThanOrEqual(3);
  });

  it('a marked palette result\u2019s gold bar on green-black', () => {
    expect(contrastRatio(hex('color.gold'), hex('color.raised'))).toBeGreaterThanOrEqual(3);
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

  it('keeps a form control\u2019s edge visible on green and on raised (F5-04)', () => {
    expect(contrastRatio(hex('color.control'), hex('color.surface'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex('color.control'), hex('color.raised'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps an edge visible on the website\u2019s cream bands, where it is ink (F-193)', () => {
    expect(contrastRatio(hex('color.inkEdge'), hex('color.cream'))).toBeGreaterThanOrEqual(3);
  });

  it.each(['1', '2', '3', '4', '5', '6'])('chart colour %s reads on green', (series) => {
    expect(contrastRatio(hex(`color.chart.${series}`), hex('color.surface'))).toBeGreaterThanOrEqual(3);
  });
});
