import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { balanceRoute } from './routes/balance.tsx';
import { frameRoute } from './routes/frame.tsx';
import { kycReturnRoute, kycRoute } from './routes/kyc.tsx';
import { learnRoute } from './routes/learn.tsx';
import { profileRoute } from './routes/profile.tsx';
import { rewardsRoute } from './routes/rewards.tsx';
import { rootRoute } from './routes/root.tsx';
import { sessionsRoute } from './routes/sessions.tsx';
import { signInRoute } from './routes/sign-in.tsx';
import { tonightRoute } from './routes/tonight.tsx';

const routeTree = rootRoute.addChildren([
  signInRoute,
  kycRoute,
  kycReturnRoute,
  frameRoute.addChildren([tonightRoute, sessionsRoute, balanceRoute, rewardsRoute, learnRoute, profileRoute]),
]);

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
