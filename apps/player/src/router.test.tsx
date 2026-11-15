import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { reportError } from './features/error-reporting/index.ts';
import { createAppRouter, routePatternOf } from './router.tsx';

describe('the player app router', () => {
  it('names the open route by its pattern, never by the address, which holds an id', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/sessions/3f2b8a1c-9d4e-4f6a-8b7c-1a2b3c4d5e6f?code=123456'] }));
    await router.load();
    expect(routePatternOf(router)).toBe('/sessions/$sessionId');
  });

  it('has no pattern to give before a route is open', () => {
    expect(routePatternOf(createAppRouter(createMemoryHistory({ initialEntries: ['/'] })))).toBe('');
  });

  it('reports a screen that failed to draw, as well as showing it', () => {
    expect(createAppRouter().options.defaultOnCatch).toBe(reportError);
  });
});
