import { createRoute } from '@tanstack/react-router';
import { LearnScreen } from '../features/learn/index.ts';
import { rootRoute } from './root.tsx';

/** Learn, gated by tier inside the feature. */
export const learnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/learn', component: LearnScreen });
