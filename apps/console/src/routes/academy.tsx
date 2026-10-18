import { createRoute } from '@tanstack/react-router';
import { AcademyPaymentsScreen, AcademyScreen } from '../features/academy/index.ts';
import { frameRoute } from './frame.tsx';

/** Academy batches and their bookings, for Academy staff. */
export const academyRoute = createRoute({ getParentRoute: () => frameRoute, path: '/academy', component: AcademyScreen });

/** Academy payments the cage checks against the bank. */
export const academyPaymentsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/academy/payments', component: AcademyPaymentsScreen });
