import { createRoute } from '@tanstack/react-router';
import { PromotionsScreen } from '../features/promotions/index.ts';
import { frameRoute } from './frame.tsx';

/** Promotions: what is running, and the builder with its previews (#84). */
export const promotionsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/promotions', component: PromotionsScreen });
