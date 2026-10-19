import { createRoute } from '@tanstack/react-router';
import { WaitlistScreen } from '../features/waitlist/index.ts';
import { frameRoute } from './frame.tsx';

/** The floor's waitlists, one per game and stake (#38). */
export const waitlistRoute = createRoute({ getParentRoute: () => frameRoute, path: '/waitlist', component: WaitlistScreen });
