import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { ShiftScreen } from '../features/treasury/index.ts';
import { frameRoute } from './frame.tsx';

/** The cage's shift: open and count, then close and history, by tab (`?tab=`; #24, #45, #606). */
export const shiftRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/shift', component: ShiftScreen, validateSearch: tabSearchFrom,
});
