import { sentryVitePlugin } from '@sentry/vite-plugin';

/**
 * Whether this build uploads source maps to Sentry (decisions 0672, 0673): only CI's staging and production builds, which
 * have `SENTRY_AUTH_TOKEN`. Every other build makes no map at all.
 */
export const uploadsSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

// The Sentry CLI inside the plugin sends nothing of its own and looks for no update. Set here, not in the workflows:
// Turborepo hands a build only the variables turbo.json names.
process.env.SENTRY_CLI_NO_TELEMETRY ??= '1';
process.env.SENTRY_CLI_NO_UPDATE_CHECK ??= '1';

/**
 * An app's source maps for its Sentry project. In a build that uploads them, the maps are hidden (no script names its map;
 * the app's Vite config sets `build.sourcemap` from `uploadsSourceMaps`), each script is marked with the id its map is
 * uploaded under, and the maps under `mapsIn` (the folder browsers are served: `./dist`, the website's `./dist/client`)
 * are uploaded and deleted, so none is deployed (and the workflows delete any left). A failed upload is a warning: a
 * release still ships, its stacks unreadable. Any other build: the plugin is off.
 */
export function sentrySourceMaps(project, { mapsIn = './dist' } = {}) {
  return sentryVitePlugin({
    disable: !uploadsSourceMaps,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: 'rivr-poker',
    project,
    telemetry: false,
    // Seen 16 Nov: with maps turned on by the app, the plugin's own clean-up left them in dist/, so they are named.
    sourcemaps: { filesToDeleteAfterUpload: [`${mapsIn}/**/*.map`] },
    // The app names its release itself (its version); a map is found by its id, so no release is made or touched.
    release: { inject: false, create: false, finalize: false },
    errorHandler: (error) => {
      process.stderr.write(`Sentry: a source-map step failed, so this build's stacks may stay minified (${error.message})\n`);
    },
  });
}
