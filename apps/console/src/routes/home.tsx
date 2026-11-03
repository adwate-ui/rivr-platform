import { createRoute } from '@tanstack/react-router';
import { floorSearchFrom, LiveFloorScreen } from '../features/live-floor/index.ts';
import { frameRoute } from './frame.tsx';

/** The console opens on the live floor; `?table=<id>&seat=<n>` opens that seat, as a member record's Show does. */
export const homeRoute = createRoute({ getParentRoute: () => frameRoute, path: '/', validateSearch: floorSearchFrom, component: LiveFloorScreen });
