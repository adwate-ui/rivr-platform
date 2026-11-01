/**
 * Copies the webfont files RIVR uses out of the @fontsource packages into dist/fonts/ and
 * writes dist/fonts.css with one @font-face per file (docs/decisions/0011).
 *
 * dist/fonts.css sits beside dist/styles.css, so its `url(./fonts/...)` paths are right
 * for both: the Tailwind CLI inlines the file into dist/styles.css unchanged, and the
 * Tailwind Vite plugin (Storybook) rewrites them relative to src/styles.css.
 * Runs before every build and every Storybook start.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * The faces, weights, styles and subsets the token typefaces need. The Devanagari face sets
 * only the ₹ sign in the text face, which Instrument Sans lacks; RIVR is English only (0027).
 * Bodoni Moda's italic sets the brand motto on the sign-in screen (Wordmark `withMotto`).
 */
const FACES = [
  { name: 'instrument-sans', weights: [400, 500, 600], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
  { name: 'noto-sans-devanagari', weights: [400, 500, 600], styles: ['normal'], subsets: ['devanagari'] },
];

/**
 * The display face, variable (UI polish audit AS-06): every weight from 400 to 900, and the optical-size axis, which the
 * browser sets from the font size, so hairlines stay sturdy at 20 px and fine at the TV's 280 px. Fontsource names the
 * family `Bodoni Moda Variable`; the tokens name it `Bodoni Moda`.
 */
const VARIABLE_FACES = [
  { name: 'bodoni-moda', family: 'Bodoni Moda', axis: 'opsz', styles: ['normal', 'italic'], subsets: ['latin', 'latin-ext'] },
];

/**
 * Bodoni Moda draws no ₹. Noto Serif Display's (SIL Open Font License; copyright and licence kept in the file) matches its
 * contrast and height, and is served inside the Bodoni Moda family for that one character. The file is the variable
 * latin-ext file of @fontsource-variable/noto-serif-display 5.3.0, subset to U+20B9 (1 KB, not 174 KB):
 * pyftsubset noto-serif-display-latin-ext-wght-normal.woff2 --unicodes=U+20B9 --name-IDs='*' --name-legacy --name-languages='*' --flavor=woff2
 * Defined last, so the browser looks here first for ₹.
 */
const RUPEE = {
  file: 'rupee-noto-serif-display.woff2',
  rule: (file) => [
    '/* The ₹ sign in the display face: Noto Serif Display, subset to U+20B9. */',
    '@font-face {',
    "  font-family: 'Bodoni Moda';",
    '  font-style: normal;',
    '  font-display: swap;',
    '  font-weight: 100 900;',
    `  src: url(./fonts/${file}) format('woff2-variations');`,
    '  unicode-range: U+20B9;',
    '}',
  ].join('\n'),
};

// fontsource writes: src: url(./files/x.woff2) format('woff2'), url(./files/x.woff) format('woff'); variable faces
// format('woff2-variations').
const SOURCE = /src: url\(\.\/files\/([\w-]+\.woff2)\) format\('(woff2(?:-variations)?)'\)[^;]*;/;

/** One @font-face block of a fontsource sheet, its file copied into dist/fonts and its source pointed there. */
function copiedRule(directory, sheet, id) {
  const blocks = readFileSync(`${directory}/${sheet}`, 'utf8').split(/(?=\/\* )/);
  const rule = blocks.find((block) => block.startsWith(`/* ${id} */`));
  const match = rule && SOURCE.exec(rule);
  if (!match) throw new Error(`No ${id} woff2 in ${directory}/${sheet}`);
  const [, file, format] = match;
  copyFileSync(`${directory}/files/${file}`, `dist/fonts/${file}`);
  return rule.replace(SOURCE, `src: url(./fonts/${file}) format('${format}');`).trim();
}

/**
 * The @font-face rule for one subset, weight and style, taken from fontsource's `<weight>.css`
 * or `<weight>-italic.css` (the per-subset files leave out `unicode-range`, which the browser
 * needs to pick the file).
 */
function fontFaceRule(name, subset, weight, style) {
  const sheet = style === 'italic' ? `${weight}-italic.css` : `${weight}.css`;
  return copiedRule(`node_modules/@fontsource/${name}`, sheet, `${name}-${subset}-${weight}-${style}`);
}

/** The same for a variable face, from `<axis>.css` or `<axis>-italic.css`, under the family the tokens use. */
function variableFaceRule({ name, family, axis }, subset, style) {
  const sheet = style === 'italic' ? `${axis}-italic.css` : `${axis}.css`;
  const rule = copiedRule(`node_modules/@fontsource-variable/${name}`, sheet, `${name}-${subset}-${axis}-${style}`);
  const named = rule.replace(`font-family: '${family} Variable';`, `font-family: '${family}';`);
  if (named === rule) throw new Error(`${name} ${subset} ${style} is not named '${family} Variable'`);
  return named;
}

mkdirSync('dist/fonts', { recursive: true });

const rules = [
  ...VARIABLE_FACES.flatMap((face) =>
    face.subsets.flatMap((subset) => face.styles.map((style) => variableFaceRule(face, subset, style))),
  ),
  ...FACES.flatMap(({ name, weights, styles, subsets }) =>
    subsets.flatMap((subset) =>
      weights.flatMap((weight) => styles.map((style) => fontFaceRule(name, subset, weight, style))),
    ),
  ),
];
copyFileSync(`fonts/${RUPEE.file}`, `dist/fonts/${RUPEE.file}`);
rules.push(RUPEE.rule(RUPEE.file));

const header = '/* Generated by packages/ui/scripts/fonts.mjs from the @fontsource packages. Do not edit. */';
writeFileSync('dist/fonts.css', `${header}\n${rules.join('\n\n')}\n`);
