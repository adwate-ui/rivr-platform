import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRouter, type ErrorComponentProps, type RouterHistory } from '@tanstack/react-router';
import { frameRoute } from './routes/frame.tsx';
import { homeRoute } from './routes/home.tsx';
import { settingsRoute } from './routes/settings.tsx';
import { kycReviewRoute } from './routes/kyc-review.tsx';
import { checkInRoute } from './routes/check-in.tsx';
import { waitlistRoute } from './routes/waitlist.tsx';
import { rootRoute } from './routes/root.tsx';
import { signInRoute } from './routes/sign-in.tsx';
import { tabletsRoute } from './routes/tablets.tsx';
import { dealerPinsRoute } from './routes/dealer-pins.tsx';
import { tvsRoute } from './routes/tvs.tsx';
import { fnbRoute } from './routes/fnb.tsx';
import { membersRoute } from './routes/members.tsx';
import { activityRoute } from './routes/activity.tsx';
import { reportsRoute } from './routes/reports.tsx';
import { staffRoute } from './routes/staff.tsx';
import { promotionsRoute } from './routes/promotions.tsx';
import { feedbackRoute } from './routes/feedback.tsx';
import { tournamentInterestRoute, tournamentsRoute } from './routes/tournaments.tsx';
import { playersTodayRoute } from './routes/players-today.tsx';
import { topUpsRoute } from './routes/top-ups.tsx';
import { timeRequestsRoute } from './routes/time-requests.tsx';
import { tablesRoute } from './routes/tables.tsx';
import { gamesHistoryRoute } from './routes/games-history.tsx';
import { websiteRoute } from './routes/website.tsx';
import { computersRoute } from './routes/computers.tsx';
import { camerasRoute } from './routes/cameras.tsx';
import { devicesRoute } from './routes/devices.tsx';
import { doorRoute } from './routes/door.tsx';
import { contentRoute } from './routes/content.tsx';
import { requestsRoute } from './routes/requests.tsx';
import { reportError } from './features/error-reporting/index.ts';

const routeTree = rootRoute.addChildren([
  signInRoute,
  frameRoute.addChildren([
    settingsRoute,
    devicesRoute,
    // Console v3's screens that hold others by tab (phase 1).
    doorRoute,
    contentRoute,
    requestsRoute,
    homeRoute, kycReviewRoute, waitlistRoute, checkInRoute, tabletsRoute, tvsRoute, computersRoute, camerasRoute, dealerPinsRoute,
    fnbRoute, membersRoute, activityRoute, staffRoute,
    feedbackRoute,
    tournamentsRoute,
    tournamentInterestRoute,
    playersTodayRoute,
    topUpsRoute,
    timeRequestsRoute,
    tablesRoute,
    gamesHistoryRoute,
    websiteRoute,
    reportsRoute,
    promotionsRoute,
  ]),
]);

/** A screen that failed to draw: the app's error screen, with Try again, in place of the router's unstyled default. */
export function ScreenFailed({ reset }: ErrorComponentProps) {
  return <Screen title={t('common.screenFailed')} status="error" onRetry={reset} />;
}

/** The console app's router; tests pass a memory history. A screen that fails to draw is reported (#1004) as well as shown. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, defaultErrorComponent: ScreenFailed, defaultOnCatch: reportError, ...(history ? { history } : {}) });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
