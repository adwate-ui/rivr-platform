import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { JackpotsScreen } from '../features/jackpots/index.ts';
import { frameRoute } from './frame.tsx';

/** The jackpot and the high hands, by tab (`?tab=`; #89, #317, #606). */
export const jackpotsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/jackpots', component: JackpotsScreen, validateSearch: tabSearchFrom,
});
