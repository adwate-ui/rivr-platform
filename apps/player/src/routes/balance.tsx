import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

// Loaded when first opened, so Balance does not count against the initial JavaScript budget.
const balance = () => import('../features/balance/index.ts');

/** Balance: the member's money at the club. */
export const balanceRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance', component: lazyRouteComponent(balance, 'BalanceScreen') });

/** Withdraw (#21): wallet cash to one of the member's verified payout accounts. */
export const withdrawRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance/withdraw', component: lazyRouteComponent(balance, 'WithdrawScreen') });
/** Deposit (#29): the club's UPI, then the amount paid and its UTR. */
export const depositRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance/deposit', component: lazyRouteComponent(balance, 'DepositScreen') });
