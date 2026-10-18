import { createRoute } from '@tanstack/react-router';
import { LearnScreen } from '../features/learn/index.ts';
import { frameRoute } from './frame.tsx';

/** Learn, gated by tier inside the feature. */
export const learnRoute = createRoute({ getParentRoute: () => frameRoute, path: '/learn', component: LearnScreen });
