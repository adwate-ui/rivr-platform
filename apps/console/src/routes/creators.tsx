import { createRoute } from '@tanstack/react-router';
import { CreatorsScreen } from '../features/creators/index.ts';
import { frameRoute } from './frame.tsx';

/** Creators: their codes, their dashboards and what they are owed (#163). */
export const creatorsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/creators', component: CreatorsScreen });
