import { createRoute, Navigate } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { frameRoute } from './frame.tsx';

/** Devices moved into Settings (console v3, decision 0455): an old link opens its kind there, the TVs by default. */
export const devicesRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/devices', validateSearch: tabSearchFrom,
  component: function DevicesRedirect() {
    const { tab } = devicesRoute.useSearch();
    return <Navigate to="/settings" search={{ tab: tab ?? 'tvs' }} replace />;
  },
});
