import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import manifestColors from '@rivr/tokens/manifest-colors.json' with { type: 'json' };
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Use this worktree's local Supabase unless CI or a deploy names a project.
defaultToLocalSupabase('VITE_');

/**
 * The installable app (#16): the manifest, with colours from the tokens and icons from the brand kit
 * (docs/brand), and a service worker that keeps the shell so the app opens offline. Data is never
 * cached by it: a screen offline shows its error state under the offline banner.
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: false,
  // Launch screens are read once, at install, so they stay out of the offline cache.
  includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'RIVR Poker Club',
    short_name: 'RIVR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
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
    // English only (#186): the Devanagari faces the stylesheet still carries are never drawn.
    globIgnores: ['**/*devanagari*'],
    navigateFallback: '/index.html',
    // A new version takes over at once, even in an app left open for days: a fix, security fixes
    // above all, never waits for every window to close (registerSW then reloads the page once).
    skipWaiting: true,
    clientsClaim: true,
  },
});

/** The browser bar's colour, from the tokens like the manifest's, so index.html holds no colour. */
const themeColor: Plugin = {
  name: 'rivr-theme-color',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: manifestColors.theme_color }, injectTo: 'head' }],
};

export default defineConfig({
  plugins: [react(), pwa, themeColor],
  server: { host: '127.0.0.1', port: appPort('player'), strictPort: true },
  preview: { host: '127.0.0.1', port: appPort('player'), strictPort: true },
});
