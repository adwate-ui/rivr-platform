import { createRoute } from '@tanstack/react-router';
import { DealerPinsScreen } from '../features/dealer-pins/index.ts';
import { frameRoute } from './frame.tsx';

/** The dealers' PINs, for the tablet sign-in (#41). */
export const dealerPinsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/dealer-pins', component: DealerPinsScreen });
