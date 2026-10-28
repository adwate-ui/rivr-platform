import { appPort, defaultToLocalSupabase } from '@rivr/config/worktree';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Use this worktree's local Supabase unless CI or a deploy names a project.
const isLocal = !process.env.VITE_SUPABASE_URL;
defaultToLocalSupabase('VITE_');
// The website's address, for the editor's preview (#129): this worktree's website locally; a deploy names it.
if (isLocal) process.env.VITE_WEB_URL ||= `http://127.0.0.1:${String(appPort('web'))}`;

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: appPort('console'), strictPort: true },
  preview: { host: '127.0.0.1', port: appPort('console'), strictPort: true },
});
