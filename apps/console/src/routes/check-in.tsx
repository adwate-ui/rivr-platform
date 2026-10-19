import { createRoute } from '@tanstack/react-router';
import { CheckInScreen } from '../features/check-in/index.ts';
import { frameRoute } from './frame.tsx';

/** Check-in at the door (#72): who is expected and who is in the room. */
export const checkInRoute = createRoute({ getParentRoute: () => frameRoute, path: '/check-in', component: CheckInScreen });
