/**
 * The custom Style Dictionary formats: the Tailwind v4 theme, the TypeScript constants,
 * the Android theme and the PWA manifest colours. CSS variables and Android colours use
 * Style Dictionary's built-in formats.
 */
import { fileHeader } from 'style-dictionary/utils';

/**
 * Which Tailwind theme namespaces each token group feeds. `--*: initial` removes Tailwind's
 * defaults first, so these are the only values utilities can use. Breakpoints feed both
 * the responsive variants (`tablet:`) and the max widths (`max-w-phone`).
 */
const THEME_NAMESPACES = [
  ['color', '--color'],
  ['font.family', '--font'],
  ['font.size', '--text'],
  ['font.weight', '--font-weight'],
  ['font.lineHeight', '--leading'],
  ['font.letterSpacing', '--tracking'],
  ['space', '--spacing'],
  ['size', '--spacing'],
  ['icon.size', '--spacing-icon'],
  ['radius', '--radius'],
  ['shadow', '--shadow'],
  ['opacity', '--opacity'],
  ['z', '--z-index'],
  ['breakpoint', '--breakpoint'],
  ['breakpoint', '--container'],
  ['motion.easing', '--ease'],
];

/** `greenBlack` becomes `green-black`. */
function kebab(segment) {
  return segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Media queries cannot read custom properties, so breakpoints carry the literal value. */
function themeValue(token, namespace) {
  return namespace === '--breakpoint' ? String(token.$value) : `var(--${token.name})`;
}

/** The Tailwind theme declarations for one token: none when Tailwind has no use for it. */
function themeDeclarations(token) {
  const dotted = token.path.join('.');
  return THEME_NAMESPACES.filter(([group]) => dotted.startsWith(`${group}.`)).map(([group, namespace]) => {
    const rest = token.path.slice(group.split('.').length).map(kebab).join('-');
    return `  ${namespace}-${rest}: ${themeValue(token, namespace)};`;
  });
}

/** Tailwind v4 theme: every utility value points at a `--rivr-*` custom property. */
export async function tailwindTheme({ dictionary, file }) {
  const lines = dictionary.allTokens.flatMap(themeDeclarations);
  return [
    await fileHeader({ file }),
    '@theme {\n  --*: initial;\n}\n',
    '@theme inline {',
    '  --default-font-family: var(--rivr-font-family-text);',
    '  --default-transition-duration: var(--rivr-motion-duration-state);',
    '  --default-transition-timing-function: var(--rivr-motion-easing-out);',
    ...lines,
    '}\n',
  ].join('\n');
}

/** Dimensions in px become plain numbers (`16px` is 16) so code can do arithmetic with them. */
function typescriptValue(token) {
  const value = token.$value;
  if (token.$type === 'dimension' && typeof value === 'string' && /^-?\d+(\.\d+)?px$/.test(value)) {
    return Number(value.slice(0, -2));
  }
  return value;
}

/** Puts `value` at `path` inside `target`, creating groups on the way. */
function setPath(target, path, value) {
  let node = target;
  for (const key of path.slice(0, -1)) {
    node[key] ??= {};
    node = node[key];
  }
  node[path[path.length - 1]] = value;
}

/** TypeScript constants: the resolved token tree and the chart palette in series order. */
export async function typescriptConstants({ dictionary, file }) {
  const tree = {};
  for (const token of dictionary.allTokens) setPath(tree, token.path, typescriptValue(token));
  const chart = dictionary.allTokens
    .filter((token) => token.path[0] === 'color' && token.path[1] === 'chart')
    .map((token) => token.$value);
  return [
    (await fileHeader({ file, commentStyle: 'short' })).trimStart(),
    '/** Every design value, resolved. Dimensions in px are numbers. */',
    `export const tokens = ${JSON.stringify(tree, null, 2)} as const;\n`,
    '/** Chart series colours in order; each reads on green. */',
    `export const chartPalette = ${JSON.stringify(chart)} as const;\n`,
  ].join('\n');
}

/** Android theme for the tablet and driver shells, built on the generated colours. */
export async function androidTheme({ file }) {
  const item = (name, color) => `    <item name="${name}">@color/rivr_color_${color}</item>`;
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    await fileHeader({ file, commentStyle: 'xml' }),
    '<resources>',
    '  <style name="Theme.Rivr" parent="Theme.AppCompat.NoActionBar">',
    item('colorPrimary', 'surface'),
    item('colorPrimaryDark', 'raised'),
    item('colorAccent', 'action'),
    item('android:windowBackground', 'surface'),
    item('android:statusBarColor', 'raised'),
    item('android:navigationBarColor', 'raised'),
    item('android:textColorPrimary', 'content'),
    item('android:textColorSecondary', 'content_muted'),
    '  </style>',
    '</resources>\n',
  ].join('\n');
}

/** PWA manifest colours: the browser chrome and the splash background. */
export function manifestColors({ dictionary }) {
  const hex = (name) => dictionary.allTokens.find((token) => token.path.join('.') === `color.${name}`)?.$value;
  return `${JSON.stringify({ theme_color: hex('raised'), background_color: hex('surface') }, null, 2)}\n`;
}
