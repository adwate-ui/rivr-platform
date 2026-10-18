import type { CapacitorConfig } from '@capacitor/cli';

// The APK is a shell around the hosted, versioned web bundle, so code and design changes reach the
// dealer tablets without reinstalling it (docs/engineering/stack.md). The release workflow sets
// RIVR_SHELL_URL; without it the APK carries the bundle built into dist/ (local and debug builds).
const shellUrl = process.env.RIVR_SHELL_URL;

const config: CapacitorConfig = {
  appId: 'club.rivr.dealer',
  appName: 'RIVR Dealer',
  webDir: 'dist',
  ...(shellUrl ? { server: { url: shellUrl } } : {}),
};

export default config;
