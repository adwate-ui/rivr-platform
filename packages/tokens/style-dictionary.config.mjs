/**
 * Builds every token output from tokens.json into generated/. Run it with
 * `pnpm --filter @rivr/tokens build`; never edit generated/ by hand.
 */
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import StyleDictionary from 'style-dictionary';
import { androidTheme, manifestColors, tailwindTheme, typescriptConstants } from './formats.mjs';

const GENERATED = 'generated/';
// Built here first, then moved into generated/ (see the end of this file).
const OUT = 'generated.next/';

StyleDictionary.registerFileHeader({
  name: 'rivr',
  // No double hyphen: these lines also become XML comments in the Android resources, where "--" is invalid.
  fileHeader: () => ['Generated from packages/tokens/tokens.json. Do not edit.', 'Run the @rivr/tokens build script after changing tokens.json.'],
});
StyleDictionary.registerFormat({ name: 'rivr/tailwind-theme', format: tailwindTheme });
StyleDictionary.registerFormat({ name: 'rivr/typescript', format: typescriptConstants });
StyleDictionary.registerFormat({ name: 'rivr/android-theme', format: androidTheme });
StyleDictionary.registerFormat({ name: 'rivr/manifest-colors', format: manifestColors });

const isColor = (token) => token.$type === 'color';

const config = {
  source: ['tokens.json'],
  usesDtcg: true,
  log: { verbosity: 'silent' },
  platforms: {
    css: {
      prefix: 'rivr',
      buildPath: OUT,
      transforms: ['attribute/cti', 'name/kebab', 'fontFamily/css', 'cubicBezier/css', 'shadow/css/shorthand'],
      options: { fileHeader: 'rivr' },
      files: [
        { destination: 'css/tokens.css', format: 'css/variables', options: { outputReferences: true } },
        { destination: 'tailwind/theme.css', format: 'rivr/tailwind-theme' },
      ],
    },
    typescript: {
      buildPath: OUT,
      transforms: ['attribute/cti', 'name/camel'],
      options: { fileHeader: 'rivr' },
      files: [{ destination: 'ts/tokens.ts', format: 'rivr/typescript' }],
    },
    android: {
      prefix: 'rivr',
      buildPath: `${OUT}android/res/values/`,
      transforms: ['attribute/cti', 'name/snake', 'color/hex8android'],
      options: { fileHeader: 'rivr' },
      files: [
        { destination: 'colors.xml', format: 'android/colors', filter: isColor },
        { destination: 'themes.xml', format: 'rivr/android-theme' },
      ],
    },
    manifest: {
      buildPath: OUT,
      transforms: ['attribute/cti'],
      files: [{ destination: 'manifest/colors.json', format: 'rivr/manifest-colors', filter: isColor }],
    },
  },
};

/** Every file under `dir`, as paths relative to it. */
function filesIn(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

rmSync(OUT, { recursive: true, force: true });
await new StyleDictionary(config).buildAllPlatforms();

// Typechecks read generated/ while CI builds in parallel, so it is never emptied: each new file
// replaces the old one in a single rename, then an output removed from the config is deleted.
const built = new Set(filesIn(OUT));
for (const file of built) {
  mkdirSync(dirname(join(GENERATED, file)), { recursive: true });
  renameSync(join(OUT, file), join(GENERATED, file));
}
for (const file of filesIn(GENERATED)) {
  if (!built.has(file)) rmSync(join(GENERATED, file));
}
rmSync(OUT, { recursive: true, force: true });
