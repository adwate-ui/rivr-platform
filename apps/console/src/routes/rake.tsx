import { createRoute } from '@tanstack/react-router';
import { RakeScreen } from '../features/tables/index.ts';
import { frameRoute } from './frame.tsx';

/** Each table type's rake, and changes from a time (#37). */
export const rakeRoute = createRoute({ getParentRoute: () => frameRoute, path: '/rake', component: RakeScreen });
