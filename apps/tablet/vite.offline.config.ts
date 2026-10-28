import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// The page a release APK shows when the hosted bundle cannot load at start (#292). Capacitor serves that one file from
// the APK and nothing beside it, so its script, styles and fonts are put inside it. Built after the app, into dist/.
// The hosted bundle it opens comes from RIVR_SHELL_URL, as the release sets it; empty elsewhere.
process.env.VITE_SHELL_URL = process.env.RIVR_SHELL_URL ?? '';

/** Moves each built script and stylesheet into offline.html itself, and drops the separate files. */
function inlineIntoPage(): Plugin {
  return {
    name: 'rivr-inline-offline-page',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = bundle['offline.html'];
      if (page === undefined || page.type !== 'asset') return;
      let html = String(page.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk') {
          // A script's own "</script" would end the tag early.
          html = html.replace(new RegExp(`<script[^>]*src="/${name}"[^>]*></script>`), () => `<script type="module">${file.code.replaceAll('</script', '<\\/script')}</script>`);
          delete bundle[name];
        } else if (name.endsWith('.css')) {
          html = html.replace(new RegExp(`<link[^>]*href="/${name}"[^>]*>`), () => `<style>${String(file.source)}</style>`);
          delete bundle[name];
        }
      }
      page.source = html;
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineIntoPage()],
  build: {
    emptyOutDir: false,
    // Fonts and images go inside the stylesheet, which goes inside the page.
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    rollupOptions: { input: 'offline.html' },
  },
});
