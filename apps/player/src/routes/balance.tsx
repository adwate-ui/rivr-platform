import { createRoute } from '@tanstack/react-router';
import { BalanceScreen } from '../features/balance/index.ts';
import { rootRoute } from './root.tsx';

/** Balance, never gated. */
export const balanceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/balance', component: BalanceScreen });
