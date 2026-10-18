import type { CapacitorConfig } from '@capacitor/cli';

// The APK is a shell around the hosted, versioned web bundle, so code and design changes reach the
// drivers' phones without reinstalling it (docs/engineering/stack.md). The release workflow sets
// RIVR_SHELL_URL; without it the APK carries the bundle built into dist/ (local and debug builds).
// Lane C adds the foreground location service the trip link needs.
const shellUrl = process.env.RIVR_SHELL_URL;

const config: CapacitorConfig = {
  appId: 'club.rivr.driver',
  appName: 'RIVR Driver',
  webDir: 'dist',
  ...(shellUrl ? { server: { url: shellUrl } } : {}),
};

export default config;
