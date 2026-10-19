import { createRoute } from '@tanstack/react-router';
import { TabletsScreen } from '../features/tablets/index.ts';
import { frameRoute } from './frame.tsx';

/** The venue's dealer tablets: add and pair, fix to a table, revoke (#41). */
export const tabletsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tablets', component: TabletsScreen });
