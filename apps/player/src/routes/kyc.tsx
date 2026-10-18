import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

// Identity is full screen, outside the frame's tabs, like sign-in, and loads on its own so its
// forms do not count against the initial JavaScript budget.
const kyc = () => import('../features/kyc/index.ts');

/** Identity: what is kept, then the hand-off to DigiLocker. */
export const kycRoute = createRoute({ getParentRoute: () => rootRoute, path: '/kyc', component: lazyRouteComponent(kyc, 'KycStartScreen') });

/** Where DigiLocker sends the member back. */
export const kycReturnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/kyc/return', component: lazyRouteComponent(kyc, 'KycReturnScreen') });
