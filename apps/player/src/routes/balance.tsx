import { createRoute, redirect } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

// Balance, Withdraw and Deposit are hidden at the owner's word (29 Oct, #627, decision 0284): the app shows no rupee.
// Their addresses go to Tonight; the screens stay in features/balance for when the club wants them back.
const toTonight = () => {
  throw redirect({ to: '/', replace: true });
};

export const balanceRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance', beforeLoad: toTonight });
export const withdrawRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance/withdraw', beforeLoad: toTonight });
export const depositRoute = createRoute({ getParentRoute: () => frameRoute, path: '/balance/deposit', beforeLoad: toTonight });
