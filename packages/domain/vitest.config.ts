import { vitestConfig } from '@rivr/config/vitest';

// Business rules carry the highest coverage target (.claude/rules/testing.md).
export default vitestConfig({ coverageLines: 95 });
