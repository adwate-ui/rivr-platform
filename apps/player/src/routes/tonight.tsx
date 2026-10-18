import { createRoute } from '@tanstack/react-router';
import { HomeScreen } from '../features/home/index.ts';
import { rootRoute } from './root.tsx';

/** Home: tonight's floor. */
export const tonightRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeScreen });
