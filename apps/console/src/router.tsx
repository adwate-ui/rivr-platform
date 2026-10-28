import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { academyPaymentsRoute, academyRoute } from './routes/academy.tsx';
import { frameRoute } from './routes/frame.tsx';
import { homeRoute } from './routes/home.tsx';
import { settingsRoute } from './routes/settings.tsx';
import { kycReviewRoute } from './routes/kyc-review.tsx';
import { cageRoute } from './routes/cage.tsx';
import { checkInRoute } from './routes/check-in.tsx';
import { waitlistRoute } from './routes/waitlist.tsx';
import { rootRoute } from './routes/root.tsx';
import { signInRoute } from './routes/sign-in.tsx';
import { tabletsRoute } from './routes/tablets.tsx';
import { dealerPinsRoute } from './routes/dealer-pins.tsx';
import { rakeRoute } from './routes/rake.tsx';
import { jackpotsRoute } from './routes/jackpots.tsx';
import { tvsRoute } from './routes/tvs.tsx';
import { fnbRoute } from './routes/fnb.tsx';
import { highHandsRoute } from './routes/high-hands.tsx';
import { markersRoute } from './routes/markers.tsx';
import { membersRoute } from './routes/members.tsx';
import { amlRoute } from './routes/aml.tsx';
import { exportsRoute } from './routes/exports.tsx';
import { purgeRoute } from './routes/purge.tsx';
import { rosterRoute } from './routes/roster.tsx';
import { killSwitchRoute } from './routes/kill-switch.tsx';
import { practiceResetRoute } from './routes/practice-reset.tsx';
import { withdrawalsRoute } from './routes/withdrawals.tsx';
import { treasuryRoute } from './routes/treasury.tsx';
import { accountsRoute } from './routes/accounts.tsx';
import { expensesRoute } from './routes/expenses.tsx';
import { shareholdersRoute } from './routes/shareholders.tsx';
import { tallyRoute } from './routes/tally.tsx';
import { ownerRoute } from './routes/owner.tsx';
import { reportsRoute } from './routes/reports.tsx';
import { tdsRoute } from './routes/tds.tsx';
import { endOfDayRoute } from './routes/end-of-day.tsx';
import { staffRoute } from './routes/staff.tsx';
import { certificationRoute } from './routes/certification.tsx';
import { promotionsRoute } from './routes/promotions.tsx';
import { sopsRoute } from './routes/sops.tsx';
import { feedbackRoute } from './routes/feedback.tsx';
import { leagueRoute } from './routes/league.tsx';
import { creatorsRoute } from './routes/creators.tsx';
import { spinWheelRoute } from './routes/spin-wheel.tsx';
import { eventsRoute } from './routes/events.tsx';
import { learnSourcesRoute } from './routes/learn-sources.tsx';
import { tournamentsRoute } from './routes/tournaments.tsx';
import { rewardsRoute } from './routes/rewards.tsx';
import { potDataRoute } from './routes/pot-data.tsx';
import { dealersRoute } from './routes/dealers.tsx';
import { incidentsRoute } from './routes/incidents.tsx';
import { tiersRoute } from './routes/tiers.tsx';
import { computersRoute } from './routes/computers.tsx';
import { camerasRoute } from './routes/cameras.tsx';

const routeTree = rootRoute.addChildren([
  signInRoute,
  frameRoute.addChildren([
    settingsRoute,
    homeRoute, academyRoute, academyPaymentsRoute, kycReviewRoute, waitlistRoute, checkInRoute, cageRoute, tabletsRoute, tvsRoute, computersRoute, camerasRoute, dealerPinsRoute, rakeRoute, jackpotsRoute,
    highHandsRoute, fnbRoute, markersRoute, membersRoute, killSwitchRoute, practiceResetRoute, purgeRoute, exportsRoute, amlRoute, withdrawalsRoute, treasuryRoute, endOfDayRoute, staffRoute, rosterRoute,
    certificationRoute,
    sopsRoute,
    incidentsRoute,
    feedbackRoute,
    rewardsRoute,
    leagueRoute,
    creatorsRoute,
    spinWheelRoute,
    eventsRoute,
    learnSourcesRoute,
    tournamentsRoute,
    accountsRoute,
    expensesRoute,
    tdsRoute,
    tallyRoute,
    reportsRoute,
    ownerRoute,
    shareholdersRoute,
    potDataRoute,
    dealersRoute,
    promotionsRoute,
    tiersRoute,
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
