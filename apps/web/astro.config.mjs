// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { sentrySourceMaps, uploadsSourceMaps } from '@rivr/config/sentry';
import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import { defineConfig } from 'astro/config';

// Use this worktree's local Supabase and player app unless CI or a deploy names others.
defaultToLocalSupabase('PUBLIC_');
process.env.PUBLIC_PLAYER_URL ||= `http://127.0.0.1:${appPort('player')}`;

/** The public website: rendered on demand on Cloudflare from content in Supabase (additions, "Resolved conflicts"). */
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
  server: { host: '127.0.0.1', port: appPort('web') },
  vite: {
    // Every page script is a file under /_astro/, never inlined into the page, so its errors are the site's own to report
    // (decision 0673: error reporting sends only errors from /_astro/).
    build: { assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined) },
    // Hidden source maps for Sentry of the browser's scripts only, in a build that uploads them; the Worker (dist/server)
    // keeps its own maps as before, which Wrangler sends to Cloudflare. @rivr/config/sentry has the rest.
    ...(uploadsSourceMaps ? { environments: { client: { build: { sourcemap: 'hidden' } } } } : {}),
    plugins: [sentrySourceMaps('rivr-web', { mapsIn: './dist/client' })],
  },
});
