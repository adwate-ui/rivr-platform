import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { DevicesScreen } from '../features/devices/index.ts';
import { frameRoute } from './frame.tsx';

/** Tablets, TVs, computers and cameras, by tab (`?tab=`; #606). */
export const devicesRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/devices', component: DevicesScreen, validateSearch: tabSearchFrom,
});
