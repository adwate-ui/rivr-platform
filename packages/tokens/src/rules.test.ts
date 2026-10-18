import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolvedTokens, tokenValue } from './token-tree.ts';

const INVENTORY = readFileSync(new URL('../../../docs/design/design-inventory.md', import.meta.url), 'utf8');

/** Rows of the inventory's token table that carry a hex value: `color.green` and `#0E3B2C`. */
function inventoryColours(): [string, string][] {
  return [...INVENTORY.matchAll(/^\| `(color\.\w+)` \| `(#[0-9A-Fa-f]{6})` \|/gm)].map((row) => [row[1] ?? '', row[2] ?? '']);
}

function px(value: unknown): number {
  if (typeof value !== 'string' || !value.endsWith('px')) throw new Error(`Not a px dimension: ${String(value)}`);
  return Number(value.slice(0, -2));
}

describe('the design inventory', () => {
  it('lists the six brand colours', () => {
    expect(inventoryColours().map(([path]) => path)).toEqual([
      'color.green',
      'color.greenBlack',
      'color.cream',
      'color.gold',
      'color.red',
      'color.ink',
    ]);
  });

  it.each(inventoryColours())('%s is %s in tokens.json', (path, hex) => {
    expect(tokenValue(path)).toBe(hex);
  });

  it('defines muted as cream at 60% and the hairline as gold at 25%', () => {
    expect(tokenValue('color.muted')).toBe(`${String(tokenValue('color.cream'))}99`);
    expect(tokenValue('color.hairline')).toBe(`${String(tokenValue('color.gold'))}40`);
  });

  it('uses the suggested type scale', () => {
    const sizes = resolvedTokens().filter((token) => token.path.startsWith('font.size.'));
    expect(sizes.map((token) => px(token.value))).toEqual([12, 13, 14, 16, 18, 20, 24, 28, 36, 44, 56, 96]);
  });

  it('sets the ₹ sign in Tiro Devanagari Hindi and Noto Sans Devanagari, after the Latin faces that lack it', () => {
    expect(tokenValue('font.family.display')).toEqual(['Bodoni Moda', 'Tiro Devanagari Hindi', 'serif']);
    expect(tokenValue('font.family.text')).toEqual(['Instrument Sans', 'Noto Sans Devanagari', 'sans-serif']);
  });
});

describe('visual rules', () => {
  it('never rounds a corner by more than 6 px', () => {
    const radii = resolvedTokens().filter((token) => token.path.startsWith('radius.'));
    expect(radii.map((token) => px(token.value))).toEqual([3, 4, 6]);
    expect(Math.max(...radii.map((token) => px(token.value)))).toBeLessThanOrEqual(6);
  });

  it('has exactly one shadow, for the modal', () => {
    expect(resolvedTokens().filter((token) => token.type === 'shadow').map((token) => token.path)).toEqual(['shadow.modal']);
  });

  it('moves in 200 ms with ease-out', () => {
    expect(tokenValue('motion.duration.state')).toBe('200ms');
    expect(tokenValue('motion.easing.out')).toEqual([0, 0, 0.58, 1]);
  });

  it('draws icons with a 1.5 px stroke and keeps touch targets at 44 px', () => {
    expect(px(tokenValue('icon.stroke'))).toBe(1.5);
    expect(px(tokenValue('size.touch'))).toBe(44);
  });

  it('breaks at the four target devices', () => {
    const widths = ['phone', 'tablet', 'console', 'tv'].map((device) => px(tokenValue(`breakpoint.${device}`)));
    expect(widths).toEqual([390, 1180, 1440, 1920]);
  });
});
