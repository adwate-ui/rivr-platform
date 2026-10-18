// @ts-check
import { vitestConfig } from './vitest/base.js';

// The ESLint tests build a TypeScript program for the type-aware rules on their first run:
// about 11 seconds on a cold CI runner, past Vitest's 5 second default.
export default vitestConfig({ testTimeout: 30_000 });
