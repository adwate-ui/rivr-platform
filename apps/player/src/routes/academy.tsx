import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';
import { rootRoute } from './root.tsx';

// Loaded when first opened, so the Academy does not count against the initial JavaScript budget.
const academy = () => import('../features/academy/index.ts');

/** RIVR Academy: open batches and the member's bookings. */
export const academyRoute = createRoute({ getParentRoute: () => frameRoute, path: '/academy', component: lazyRouteComponent(academy, 'AcademyScreen') });

/** Paying for one booking by UPI, with its UTR. */
export const academyPaymentRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/academy/$bookingId',
  component: lazyRouteComponent(academy, 'AcademyPaymentScreen'),
});

/** A paid booking's invoice, on its own page with no app frame, so printing saves just the invoice (#249). */
export const academyInvoiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academy/$bookingId/invoice',
  component: lazyRouteComponent(academy, 'AcademyInvoiceScreen'),
});
