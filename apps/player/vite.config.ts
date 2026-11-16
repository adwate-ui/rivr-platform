import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import manifestColors from '@rivr/tokens/manifest-colors.json' with { type: 'json' };
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const isLocal = !process.env.VITE_SUPABASE_URL;
// Use this worktree's local Supabase unless CI or a deploy names a project.
defaultToLocalSupabase('VITE_');
// The website's address, for the terms and privacy links (#775): this worktree's website locally; a deploy names it.
if (isLocal) process.env.VITE_WEB_URL ||= `http://127.0.0.1:${String(appPort('web'))}`;

/**
 * The installable app (#16): the manifest, with colours from the tokens and icons from the brand kit
 * (docs/brand), and a service worker that keeps the shell so the app opens offline. Data is never
 * cached by it: a screen offline shows its error state under the offline banner.
 */
const pwa = VitePWA({
  // A new version waits to be taken (main.tsx), so a reload never lands on a member mid-entry (#252).
  registerType: 'prompt',
  injectRegister: false,
  // Launch screens are read once, at install, so they stay out of the offline cache.
  includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'RIVR Poker Club',
    short_name: 'RIVR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: manifestColors.theme_color,
    background_color: manifestColors.background_color,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png'],
    // English only (#186): the Devanagari faces the stylesheet still carries are never drawn. Sentry's chunk
    // (features/error-reporting/sentry.ts) is fetched only by a build that reports errors, so a phone never keeps it unasked.
    globIgnores: ['**/*devanagari*', '**/sentry-*.js'],
    navigateFallback: '/index.html',
    // Web push (#139): public/push-sw.js shows each notification and opens its page when tapped.
    importScripts: ['push-sw.js'],
    // A new version waits until the app takes it, once out of sight, rather than for every window to
    // close: a fix, a security fix above all, reaches an app left open for days within an hour of
    // the member next leaving it. The first version serves the page that installed it at once.
    skipWaiting: false,
    clientsClaim: true,
    // The service worker is Workbox's code, not the app's: no map, even in a build that makes the app's (decision 0672).
    sourcemap: false,
  },
});

/** The browser bar's colour, from the tokens like the manifest's, so index.html holds no colour. */
const themeColor: Plugin = {
  name: 'rivr-theme-color',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: manifestColors.theme_color }, injectTo: 'head' }],
};

/**
 * Source maps for Sentry (decision 0672), only in a build that can upload them: CI's staging and production builds, which
 * have `SENTRY_AUTH_TOKEN`. Their maps are hidden (no script names its map); the plugin marks each script with the id its
 * map is uploaded under, uploads the maps and deletes them from dist/, so none is deployed (and the workflows delete any
 * left). Any other build makes no map at all. A failed upload is a warning: a release still ships, its stacks unreadable.
 */
const uploadsSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);
// The Sentry CLI inside the plugin sends nothing of its own and looks for no update. Set here, not in the workflows:
// Turborepo hands a build only the variables turbo.json names.
process.env.SENTRY_CLI_NO_TELEMETRY ??= '1';
process.env.SENTRY_CLI_NO_UPDATE_CHECK ??= '1';
const sourceMaps = sentryVitePlugin({
  disable: !uploadsSourceMaps,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: 'rivr-poker',
  project: 'rivr-player',
  telemetry: false,
  // Seen 16 Nov: with maps turned on here, the plugin's own clean-up left them in dist/, so they are named.
  sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
  // The app names its release itself (VITE_APP_VERSION); a map is found by its id, so no release is made or touched.
  release: { inject: false, create: false, finalize: false },
  errorHandler: (error) => {
    process.stderr.write(`Sentry: a source-map step failed, so this build's stacks may stay minified (${error.message})\n`);
  },
});

export default defineConfig({
  plugins: [react(), pwa, themeColor, sourceMaps],
  build: { sourcemap: uploadsSourceMaps ? 'hidden' : false },
  server: { host: '127.0.0.1', port: appPort('player'), strictPort: true },
  preview: { host: '127.0.0.1', port: appPort('player'), strictPort: true },
});
