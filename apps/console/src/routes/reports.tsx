import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { ReportsScreen } from '../features/reports/index.ts';
import { frameRoute } from './frame.tsx';

/** Tonight's rake by table, dealer and game, the monthly investor MIS and the rest, one by tab (`?tab=`; #99, #605). */
export const reportsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/reports', component: ReportsScreen, validateSearch: tabSearchFrom,
});
