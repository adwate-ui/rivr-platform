import { createRoute } from '@tanstack/react-router';
import { ModeScreen } from '../features/modes/index.ts';
import { rootRoute } from './root.tsx';

/** A paired TV shows the mode the console gave it (#49). */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: ModeScreen });
