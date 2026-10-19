import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { academyPaymentsRoute, academyRoute } from './routes/academy.tsx';
import { frameRoute } from './routes/frame.tsx';
import { homeRoute } from './routes/home.tsx';
import { kycReviewRoute } from './routes/kyc-review.tsx';
import { checkInRoute } from './routes/check-in.tsx';
import { waitlistRoute } from './routes/waitlist.tsx';
import { rootRoute } from './routes/root.tsx';
import { signInRoute } from './routes/sign-in.tsx';
import { tabletsRoute } from './routes/tablets.tsx';
import { dealerPinsRoute } from './routes/dealer-pins.tsx';
import { rakeRoute } from './routes/rake.tsx';
import { jackpotsRoute } from './routes/jackpots.tsx';
import { tvsRoute } from './routes/tvs.tsx';
import { highHandsRoute } from './routes/high-hands.tsx';

const routeTree = rootRoute.addChildren([
  signInRoute,
  frameRoute.addChildren([
    homeRoute, academyRoute, academyPaymentsRoute, kycReviewRoute, waitlistRoute, checkInRoute, tabletsRoute, tvsRoute, dealerPinsRoute, rakeRoute, jackpotsRoute,
    highHandsRoute,
  ]),
]);

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
