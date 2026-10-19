import { vitestConfig } from '@rivr/config/vitest';

export default vitestConfig({ environment: 'jsdom', setupFiles: ['./src/messages.ts'] });
