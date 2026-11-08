import { vitestConfig } from '@rivr/config/vitest';

// Pure logic lives in src/ and is held to 80% line coverage. bin/ drives Docker, psql and the CLI,
// and census/, walks/ and staging/ drive browsers; those run by hand, not in unit tests.
export default vitestConfig({ coverageLines: 80 });
