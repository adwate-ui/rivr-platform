import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

// Loaded when first opened, so the card does not count against the initial JavaScript budget.
const card = () => import('../features/card/index.ts');

/** The membership card (#71), from Profile: the QR the door scans. */
export const cardRoute = createRoute({ getParentRoute: () => frameRoute, path: '/card', component: lazyRouteComponent(card, 'CardScreen') });
