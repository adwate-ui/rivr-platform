import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { ScreenFailed } from './features/frame/index.ts';
import { homeRoute } from './routes/home.tsx';
import { rootRoute, tvRoute } from './routes/root.tsx';
import { reportError } from './features/error-reporting/index.ts';

const routeTree = rootRoute.addChildren([tvRoute.addChildren([homeRoute])]);

/** The display app's router; tests pass a memory history. A screen that fails to draw is reported (#1004) as well as shown. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, defaultErrorComponent: ScreenFailed, defaultOnCatch: reportError, ...(history ? { history } : {}) });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
