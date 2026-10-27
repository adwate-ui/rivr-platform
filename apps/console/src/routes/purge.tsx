import { createRoute } from '@tanstack/react-router';
import { PurgeScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** Purge a live venue (#432): frozen, archived first, its name typed. */
export const purgeRoute = createRoute({ getParentRoute: () => frameRoute, path: '/purge', component: PurgeScreen });
