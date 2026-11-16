import { sentrySourceMaps, uploadsSourceMaps } from '@rivr/config/sentry';
import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Use this worktree's local Supabase unless CI or a deploy names a project.
const isLocal = !process.env.VITE_SUPABASE_URL;
defaultToLocalSupabase('VITE_');
// The website's address, for the editor's preview (#129): this worktree's website locally; a deploy names it.
if (isLocal) process.env.VITE_WEB_URL ||= `http://127.0.0.1:${String(appPort('web'))}`;

export default defineConfig({
  // Hidden source maps for Sentry, only in a build that uploads them (decision 0673); @rivr/config/sentry has the rest.
  plugins: [react(), sentrySourceMaps('rivr-console')],
  build: { sourcemap: uploadsSourceMaps ? 'hidden' : false },
  server: { host: '127.0.0.1', port: appPort('console'), strictPort: true },
  preview: { host: '127.0.0.1', port: appPort('console'), strictPort: true },
});
