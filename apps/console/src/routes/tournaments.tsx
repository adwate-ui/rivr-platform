import { createRoute, Navigate } from '@tanstack/react-router';
import { tabSearchFrom, useNavigateKeepingViews } from '../features/frame/index.ts';
import { TournamentsScreen } from '../features/tournaments/index.ts';
import { frameRoute } from './frame.tsx';

function TournamentsPage() {
  const { tab } = tournamentsRoute.useSearch();
  const navigate = useNavigateKeepingViews();
  return <TournamentsScreen tab={tab} onNavigate={navigate} />;
}

/** Tournaments, under Marketing (redesign RD-26): Upcoming, and Past with `?tab=past`. */
export const tournamentsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tournaments', validateSearch: tabSearchFrom, component: TournamentsPage });

/** Tournament interest was a tab of the Waitlist: an old link or bookmark opens Tournaments. */
export const tournamentInterestRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/tournament-interest', component: () => <Navigate to="/tournaments" replace />,
});
