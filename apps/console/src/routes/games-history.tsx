import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Games history is retired (the owner, 9 Nov): an old link or bookmark opens Settings, saying Reports, Tables has it. */
export const gamesHistoryRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/games-history', component: () => <Navigate to="/settings" search={{ notice: 'gamesHistory' }} replace />,
});
