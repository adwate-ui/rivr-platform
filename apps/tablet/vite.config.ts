import { sentrySourceMaps, uploadsSourceMaps } from '@rivr/config/sentry';
import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Use this worktree's local Supabase unless CI or a deploy names a project.
defaultToLocalSupabase('VITE_');

export default defineConfig({
  // Hidden source maps for Sentry, only in a build that uploads them (decision 0673); @rivr/config/sentry has the rest.
  plugins: [react(), sentrySourceMaps('rivr-tablet')],
  build: { sourcemap: uploadsSourceMaps ? 'hidden' : false },
  server: { host: '127.0.0.1', port: appPort('tablet'), strictPort: true },
  preview: { host: '127.0.0.1', port: appPort('tablet'), strictPort: true },
});
