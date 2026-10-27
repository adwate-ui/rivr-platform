import { createRoute } from '@tanstack/react-router';
import { EventsScreen } from '../features/events/index.ts';
import { frameRoute } from './frame.tsx';

/** The events calendar: pro nights and corporate tables, and their bookings (#143). */
export const eventsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/events', component: EventsScreen });
