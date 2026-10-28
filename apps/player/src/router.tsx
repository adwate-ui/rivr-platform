import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { balanceRoute, depositRoute, withdrawRoute } from './routes/balance.tsx';
import { cardRoute } from './routes/card.tsx';
import { frameRoute } from './routes/frame.tsx';
import { kycReturnRoute, kycRoute } from './routes/kyc.tsx';
import { learnBookRoute, learnRoute } from './routes/learn.tsx';
import { academyInvoiceRoute, academyPaymentRoute, academyRoute } from './routes/academy.tsx';
import { profileRoute } from './routes/profile.tsx';
import { fnbRoute } from './routes/fnb.tsx';
import { eventsRoute } from './routes/events.tsx';
import { rewardsRoute } from './routes/rewards.tsx';
import { rootRoute } from './routes/root.tsx';
import { sessionRoute, sessionsRoute } from './routes/sessions.tsx';
import { signInRoute } from './routes/sign-in.tsx';
import { signUpRoute } from './routes/sign-up.tsx';
import { tonightRoute } from './routes/tonight.tsx';

const routeTree = rootRoute.addChildren([
  academyInvoiceRoute,
  signInRoute,
  signUpRoute,
  kycRoute,
  kycReturnRoute,
  frameRoute.addChildren([tonightRoute, sessionsRoute, sessionRoute, balanceRoute, withdrawRoute, depositRoute, rewardsRoute, learnRoute, learnBookRoute, academyRoute, academyPaymentRoute, profileRoute, cardRoute, fnbRoute, eventsRoute]),
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
