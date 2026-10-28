import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { StaffScreen } from '../features/staff/index.ts';
import { frameRoute } from './frame.tsx';

/** The venue's staff and the dealers' PINs, by tab (`?tab=`; #106, #606). */
export const staffRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/staff', component: StaffScreen, validateSearch: tabSearchFrom,
});
