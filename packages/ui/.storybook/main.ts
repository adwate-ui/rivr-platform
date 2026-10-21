import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { mergeConfig } from 'vite';

/**
 * Storybook for @rivr/ui: the living design system. Tailwind runs here through its Vite
 * plugin, inside @rivr/ui only (docs/decisions/0005); apps get the compiled stylesheet.
 */
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
  // The public website's own photos and video, so its blocks' stories show them (decision 0118).
  staticDirs: [{ from: '../../../apps/web/public/media', to: '/media' }],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      build: {
        rolldownOptions: {
          // lucide-react marks its modules "use client", which means nothing outside a server framework.
          onwarn(warning, warn) {
            if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
          },
        },
      },
    }),
};

export default config;
