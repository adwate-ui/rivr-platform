import { createRoute } from '@tanstack/react-router';
import { TopUpsScreen } from '../features/top-ups/index.ts';
import { frameRoute } from './frame.tsx';

/** The top-ups waiting and tonight's closed ones, on a page of their own (decision 0299). */
export const topUpsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/top-ups', component: TopUpsScreen });
