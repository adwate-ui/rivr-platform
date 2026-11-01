import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { ScreenFailed } from './features/frame/index.ts';
import { homeRoute } from './routes/home.tsx';
import { overlayRoute } from './routes/overlay.tsx';
import { rootRoute, tvRoute } from './routes/root.tsx';

const routeTree = rootRoute.addChildren([tvRoute.addChildren([homeRoute]), overlayRoute]);

/** The display app's router; tests pass a memory history. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, defaultErrorComponent: ScreenFailed, ...(history ? { history } : {}) });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
