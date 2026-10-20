import { createRoute } from '@tanstack/react-router';
import { ComputersScreen } from '../features/computers/index.ts';
import { frameRoute } from './frame.tsx';

/** The venue's cage and admin computers: enrol this one, revoke one (#384). */
export const computersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/computers', component: ComputersScreen });
