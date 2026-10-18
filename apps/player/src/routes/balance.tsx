import { createRoute } from '@tanstack/react-router';
import { BalanceScreen } from '../features/balance/index.ts';
import { frameRoute } from './frame.tsx';

/** Balance, never gated. */
export const balanceRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance', component: BalanceScreen });
