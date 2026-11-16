import type { sentryVitePlugin } from '@sentry/vite-plugin';

/** Whether this build uploads source maps to Sentry: only a build with `SENTRY_AUTH_TOKEN` (CI's staging and production). */
export const uploadsSourceMaps: boolean;
/**
 * The Vite plugins that upload an app's hidden source maps to its Sentry project and delete those under `mapsIn` (the folder
 * browsers are served, `./dist` by default); off without the token.
 */
export function sentrySourceMaps(
  project: `rivr-${'player' | 'console' | 'tablet' | 'display' | 'web'}`,
  options?: { readonly mapsIn?: string },
): ReturnType<typeof sentryVitePlugin>;
