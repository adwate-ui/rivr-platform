import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Use this worktree's local Supabase unless CI or a deploy names a project.
defaultToLocalSupabase('VITE_');

export default defineConfig({
  plugins: [react()],
  server: { port: appPort('player'), strictPort: true },
  preview: { port: appPort('player'), strictPort: true },
});
