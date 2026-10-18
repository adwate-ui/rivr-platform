import { vitestConfig } from '@rivr/config/vitest';

// The generator and grader property tests search thousands of dealt spots. Alone they take up to
// 5 s; with every package's tests running at once, or on a 4-core CI runner, they take two to
// three times longer. They are deterministic (seeded), so a longer limit hides nothing.
export default vitestConfig({ testTimeout: 30_000 });
