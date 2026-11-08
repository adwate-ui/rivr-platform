import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { ReportsScreen } from '../features/reports/index.ts';
import { frameRoute } from './frame.tsx';

/** Reports: the money-free Tables view alone (owner, 8 Nov); the money reports' tabs (`?tab=`; #99, #605) open Tables. */
export const reportsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/reports', component: ReportsScreen, validateSearch: tabSearchFrom,
});
