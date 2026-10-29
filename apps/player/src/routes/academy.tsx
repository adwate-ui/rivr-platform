import { createRoute, redirect } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';
import { rootRoute } from './root.tsx';

// The Academy's batches, payments and invoices are hidden at the owner's word (29 Oct, #627, decision 0284): the app
// takes no payments. Their addresses go to Learn; the screens stay in features/academy for when the club wants them back.
const toLearn = () => {
  throw redirect({ to: '/learn', replace: true });
};

export const academyRoute = createRoute({ getParentRoute: () => frameRoute, path: '/academy', beforeLoad: toLearn });
export const academyPaymentRoute = createRoute({ getParentRoute: () => frameRoute, path: '/academy/$bookingId', beforeLoad: toLearn });
export const academyInvoiceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/academy/$bookingId/invoice', beforeLoad: toLearn });
