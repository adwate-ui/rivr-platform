import { createRoute } from '@tanstack/react-router';
import { ReportsScreen } from '../features/reports/index.ts';
import { frameRoute } from './frame.tsx';

/** Tonight's rake by table, dealer and game, and the monthly investor MIS (#99). */
export const reportsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/reports', component: ReportsScreen });
