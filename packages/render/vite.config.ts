import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Builds the render host: one page that mounts a template with props, so headless Chromium
 * can draw it with the same @rivr/ui stylesheet the apps load. Output: dist/host/.
 */
export default defineConfig({
  root: fileURLToPath(new URL('./src/host', import.meta.url)),
  // Relative asset paths, so the page works however it is served.
  base: './',
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('./dist/host', import.meta.url)), emptyOutDir: true },
  logLevel: 'warn',
});
