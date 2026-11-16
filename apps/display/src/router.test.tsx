import { describe, expect, it } from 'vitest';
import { reportError } from './features/error-reporting/index.ts';
import { createAppRouter } from './router.tsx';

describe('the display app router', () => {
  it('reports a screen that failed to draw, as well as showing it', () => {
    expect(createAppRouter().options.defaultOnCatch).toBe(reportError);
  });
});
