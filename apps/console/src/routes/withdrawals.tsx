import { createRoute } from '@tanstack/react-router';
import { WithdrawalsScreen } from '../features/withdrawals/index.ts';
import { frameRoute } from './frame.tsx';

/** Withdrawals (#21): members' withdrawals waiting for the cage and its second approvers. */
export const withdrawalsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/withdrawals', component: WithdrawalsScreen });