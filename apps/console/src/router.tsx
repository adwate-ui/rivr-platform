import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { frameRoute } from './routes/frame.tsx';
import { homeRoute } from './routes/home.tsx';
import { rootRoute } from './routes/root.tsx';
import { signInRoute } from './routes/sign-in.tsx';

const routeTree = rootRoute.addChildren([signInRoute, frameRoute.addChildren([homeRoute])]);

/** The console app's router; tests pass a memory history. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter(history ? { routeTree, history } : { routeTree });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
