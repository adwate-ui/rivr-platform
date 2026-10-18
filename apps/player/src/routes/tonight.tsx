import { createRoute } from '@tanstack/react-router';
import { HomeScreen } from '../features/home/index.ts';
import { frameRoute } from './frame.tsx';

/** Home: tonight's floor. */
export const tonightRoute = createRoute({ getParentRoute: () => frameRoute, path: '/', component: HomeScreen });
