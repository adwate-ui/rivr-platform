import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { CorrectSession } from '../features/promotions/index.ts';
import { ReportsScreen } from '../features/reports/index.ts';
import { frameRoute } from './frame.tsx';

// A visit's correction from the Players report (#1075): the promotions feature draws the panel Bonus approvals uses.
const Reports = () => <ReportsScreen correct={CorrectSession} />;

/** Reports: the money-free Tables view alone (owner, 8 Nov); the money reports' tabs (`?tab=`; #99, #605) open Tables. */
export const reportsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/reports', component: Reports, validateSearch: tabSearchFrom,
});
