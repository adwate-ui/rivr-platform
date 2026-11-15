import { createRoute } from '@tanstack/react-router';
import { TopUpsScreen } from '../features/top-ups/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Top-ups, a screen of its own again (redesign RD-32): guest relations' whole console, and for the floor, who also have
 * them in Requests (console v3, decision 0479), tonight's and past days' with who took each step.
 */
export const topUpsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/top-ups', component: TopUpsScreen });
