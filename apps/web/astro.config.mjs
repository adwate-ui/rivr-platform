// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import { defineConfig } from 'astro/config';

// Use this worktree's local Supabase unless CI or a deploy names a project.
defaultToLocalSupabase('PUBLIC_');

/** The public website: rendered on demand on Cloudflare from content in Supabase (additions, "Resolved conflicts"). */
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
  server: { host: '127.0.0.1', port: appPort('web') },
});
