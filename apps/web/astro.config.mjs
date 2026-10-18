// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
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
});
