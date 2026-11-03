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

  it('uses the suggested type scale, and the TV scale beside it', () => {
    const sizes = resolvedTokens().filter((token) => token.path.startsWith('font.size.'));
    const suggested = [12, 13, 14, 16, 18, 20, 24, 28, 36, 44, 56, 96];
    // The prototype's TV, read across a room (design inventory, decision 0052).
    const tv = [48, 88, 280];
    // The player app's redesign (decision 0320).
    const player = [32, 40, 72, 160];
    // The console v3 redesign's body (decision 0462).
    const console = [15];
    expect(sizes.map((token) => px(token.value))).toEqual([...suggested, ...tv, ...player, ...console].sort((a, b) => a - b));
    expect(INVENTORY).toContain('TV scale: 48, 88, 280.');
    expect(INVENTORY).toContain('Player scale: 32, 40, 72, 160.');
    expect(INVENTORY).toContain('Console scale: 15.');
  });

  it('sets the text face\'s ₹ sign in Noto Sans Devanagari, after Instrument Sans, which lacks it; the display face carries its own', () => {
    expect(tokenValue('font.family.display')).toEqual(['Bodoni Moda', 'serif']);
    expect(tokenValue('font.family.text')).toEqual(['Instrument Sans', 'Noto Sans Devanagari', 'sans-serif']);
  });
});

describe('visual rules', () => {
  it('never rounds a corner by more than 6 px, besides the player redesign\'s card and sheet (decision 0320)', () => {
    const radii = resolvedTokens().filter((token) => token.path.startsWith('radius.'));
    const product = radii.filter((token) => !['radius.card', 'radius.sheet'].includes(token.path));
    expect(product.map((token) => px(token.value))).toEqual([3, 4, 6]);
    expect(Math.max(...product.map((token) => px(token.value)))).toBeLessThanOrEqual(6);
    expect(px(tokenValue('radius.card'))).toBe(8);
    expect(px(tokenValue('radius.sheet'))).toBe(16);
  });

  it('has exactly one shadow, for the modal', () => {
    expect(resolvedTokens().filter((token) => token.type === 'shadow').map((token) => token.path)).toEqual(['shadow.modal']);
  });

  it('moves in 200 ms with ease-out; the logo animation only staggers its tiles', () => {
    expect(tokenValue('motion.duration.state')).toBe('200ms');
    expect(tokenValue('motion.duration.stagger')).toBe('120ms');
    expect(tokenValue('motion.easing.out')).toEqual([0, 0, 0.58, 1]);
  });

  it('slides a sheet up in 240 ms and moves a live timer on in one-second steps (decision 0320)', () => {
    expect(tokenValue('motion.duration.sheet')).toBe('240ms');
    expect(tokenValue('motion.duration.tick')).toBe('1000ms');
  });

  it('draws icons with a 1.5 px stroke and keeps touch targets at 44 px', () => {
    expect(px(tokenValue('icon.stroke'))).toBe(1.5);
    expect(px(tokenValue('size.touch'))).toBe(44);
  });

  it('breaks at the four target devices', () => {
    const widths = ['phone', 'tablet', 'console', 'tv'].map((device) => px(tokenValue(`breakpoint.${device}`)));
    expect(widths).toEqual([390, 1180, 1440, 1920]);
  });

  it('folds the console rail to icons below 1200 px, past the floor\'s 1180 px tablets (console v3)', () => {
    expect(px(tokenValue('breakpoint.wide'))).toBe(1200);
    expect(px(tokenValue('size.rail'))).toBe(224);
    expect(px(tokenValue('size.railCollapsed'))).toBe(64);
  });

  it('sets the console\'s rows at 42 px, or 34 px compact (console v3)', () => {
    expect(px(tokenValue('size.row'))).toBe(42);
    expect(px(tokenValue('size.rowCompact'))).toBe(34);
  });
});
