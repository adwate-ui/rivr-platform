import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chartPalette, tokens } from '../generated/ts/tokens.ts';
import { resolvedTokens, tokenValue, type FlatToken } from './token-tree.ts';

function generatedFile(path: string): string {
  return readFileSync(new URL(`../generated/${path}`, import.meta.url), 'utf8');
}

/** The value at a dotted path inside the generated tree. */
function generatedValue(path: string): unknown {
  let node: unknown = tokens;
  for (const key of path.split('.')) {
    node = typeof node === 'object' && node !== null ? Reflect.get(node, key) : undefined;
  }
  return node;
}

/** What the TypeScript output should hold: px dimensions become numbers. */
function expectedTypescriptValue({ type, value }: FlatToken): unknown {
  if (type === 'dimension' && typeof value === 'string' && value.endsWith('px')) return Number(value.slice(0, -2));
  return value;
}

/** `font.lineHeight.tight` becomes `--rivr-font-line-height-tight`. */
function cssVariable(path: string): string {
  return `--rivr-${path.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replaceAll('.', '-')}`;
}

describe('generated TypeScript', () => {
  it.each(resolvedTokens().map((token) => [token.path, token] as const))('holds %s as in tokens.json', (path, token) => {
    expect(generatedValue(path)).toEqual(expectedTypescriptValue(token));
  });

  it('lists the chart palette in series order', () => {
    expect(chartPalette).toEqual(['1', '2', '3', '4', '5', '6'].map((series) => tokenValue(`color.chart.${series}`)));
  });
});

describe('generated CSS', () => {
  const css = generatedFile('css/tokens.css');
  const theme = generatedFile('tailwind/theme.css');

  it('declares a --rivr-* custom property for every token', () => {
    const missing = resolvedTokens().map((token) => cssVariable(token.path)).filter((name) => !css.includes(`${name}:`));
    expect(missing).toEqual([]);
  });

  it('resets Tailwind before adding token values, so no default utility exists', () => {
    expect(theme.indexOf('--*: initial;')).toBeGreaterThan(-1);
    expect(theme.indexOf('--*: initial;')).toBeLessThan(theme.indexOf('--color-surface'));
    expect(theme).toContain('--color-surface: var(--rivr-color-surface);');
  });

  it('marks generated files as not for editing', () => {
    for (const path of ['css/tokens.css', 'tailwind/theme.css', 'ts/tokens.ts', 'android/res/values/colors.xml']) {
      expect(generatedFile(path)).toContain('Do not edit.');
    }
  });
});

describe('generated platform colours', () => {
  it('gives the PWA manifest the raised and surface colours', () => {
    expect(JSON.parse(generatedFile('manifest/colors.json'))).toEqual({
      theme_color: tokenValue('color.raised'),
      background_color: tokenValue('color.surface'),
    });
  });

  it('writes Android colours as #AARRGGBB', () => {
    expect(generatedFile('android/res/values/colors.xml')).toContain('<color name="rivr_color_surface">#ff0e3b2c</color>');
    expect(generatedFile('android/res/values/themes.xml')).toContain('@color/rivr_color_surface');
  });
});
