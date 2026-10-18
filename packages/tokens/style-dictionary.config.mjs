/**
 * Builds every token output from tokens.json into generated/. Run it with
 * `pnpm --filter @rivr/tokens build`; never edit generated/ by hand.
 */
import { rmSync } from 'node:fs';
import StyleDictionary from 'style-dictionary';
import { androidTheme, manifestColors, tailwindTheme, typescriptConstants } from './formats.mjs';

const OUT = 'generated/';

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

// Start clean so an output removed from the config does not linger in generated/.
rmSync(OUT, { recursive: true, force: true });
await new StyleDictionary(config).buildAllPlatforms();
