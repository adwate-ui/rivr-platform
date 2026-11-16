import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRouter, type ErrorComponentProps, type RouterHistory } from '@tanstack/react-router';
import { reportError } from './features/error-reporting/index.ts';
import { bonusRoute } from './routes/bonus.tsx';
import { frameRoute } from './routes/frame.tsx';
import { kycReturnRoute, kycRoute } from './routes/kyc.tsx';
import { houseRulesRoute, profileRoute } from './routes/profile.tsx';
import { fnbRoute } from './routes/fnb.tsx';
import { rootRoute } from './routes/root.tsx';
import { sessionRoute, sessionsRoute } from './routes/sessions.tsx';
import { signInRoute } from './routes/sign-in.tsx';
import { signUpRoute } from './routes/sign-up.tsx';
import { tonightRoute } from './routes/tonight.tsx';

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  kycRoute,
  kycReturnRoute,
  frameRoute.addChildren([tonightRoute, sessionsRoute, sessionRoute, bonusRoute, profileRoute, houseRulesRoute, fnbRoute]),
]);

/** A screen that failed to draw: the app's error screen, with Try again, in place of the router's unstyled default. */
function ScreenFailed({ reset }: ErrorComponentProps) {
  return <Screen title={t('common.screenFailed')} status="error" onRetry={reset} />;
}

/** The player app's router; tests pass a memory history. A screen that fails to draw is reported (#928) as well as shown. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, defaultErrorComponent: ScreenFailed, defaultOnCatch: reportError, ...(history ? { history } : {}) });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
