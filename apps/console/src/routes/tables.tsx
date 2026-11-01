import { createRoute } from '@tanstack/react-router';
import { TablesSetupScreen } from '../features/tables-setup/index.ts';
import { frameRoute } from './frame.tsx';

/** The stakes and tables the club runs, for the super admin (#642). */
export const tablesRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tables', component: TablesSetupScreen });
