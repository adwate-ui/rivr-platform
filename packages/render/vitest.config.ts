import { vitestConfig } from '@rivr/config/vitest';
import { mergeConfig } from 'vitest/config';

// Rendering runs in Node and drives Chromium, so the tests need no DOM, a built host page
// (vitest.global-setup.ts) and time for a browser to start.
export default mergeConfig(vitestConfig({ environment: 'node', setupFiles: ['./src/messages.ts'] }), {
  test: { globalSetup: ['./vitest.global-setup.ts'], testTimeout: 60_000 },
});
