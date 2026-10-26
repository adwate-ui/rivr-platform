import { createRoute } from '@tanstack/react-router';
import { AccountsScreen } from '../features/treasury/index.ts';
import { frameRoute } from './frame.tsx';

/** Payment accounts, transfers and statements (#94). */
export const accountsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/accounts', component: AccountsScreen });
