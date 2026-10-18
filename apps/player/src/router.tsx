import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { balanceRoute } from './routes/balance.tsx';
import { learnRoute } from './routes/learn.tsx';
import { profileRoute } from './routes/profile.tsx';
import { rewardsRoute } from './routes/rewards.tsx';
import { rootRoute } from './routes/root.tsx';
import { sessionsRoute } from './routes/sessions.tsx';
import { tonightRoute } from './routes/tonight.tsx';

const routeTree = rootRoute.addChildren([tonightRoute, sessionsRoute, balanceRoute, rewardsRoute, learnRoute, profileRoute]);

/** The player app's router; tests pass a memory history. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter(history ? { routeTree, history } : { routeTree });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
