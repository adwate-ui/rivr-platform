import { defineConfig } from 'vite';

// One file the cage computer runs with Node 22 alone: every dependency is bundled in.
export default defineConfig({
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'rivr-agent.mjs' } },
  },
  ssr: { noExternal: true },
});
