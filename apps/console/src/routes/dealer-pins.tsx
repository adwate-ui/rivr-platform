import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Dealer PINs moved into Staff (#606): an old link or bookmark opens its tab there. */
export const dealerPinsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/dealer-pins', component: () => <Navigate to="/staff" search={{ tab: 'dealerPins' }} replace />,
});
