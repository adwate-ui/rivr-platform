import type { CapacitorConfig } from '@capacitor/cli';

// The phone app is a shell around the hosted player app (decision 0323), as the dealer tablet's APK is around its bundle:
// code and design changes reach phones without a store update. A release build sets RIVR_SHELL_URL to the player app's
// address; without it the shell carries the bundle built into dist/ (local and debug builds). The shell adds what a PWA
// cannot do: the lock-screen live status, through the app's own LiveStatus plugin (android/ and ios/, decision 0361).
const shellUrl = process.env.RIVR_SHELL_URL;

const config: CapacitorConfig = {
  appId: 'club.rivr.player',
  appName: 'RIVR',
  webDir: 'dist',
  // offline.html comes from the app, for when the hosted app cannot load (decision 0577).
  ...(shellUrl ? { server: { url: shellUrl, errorPath: 'offline.html' } } : {}),
};

export default config;
