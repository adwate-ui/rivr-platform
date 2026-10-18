import { createRoute } from '@tanstack/react-router';
import { UnpairedScreen } from '../features/pairing/index.ts';
import { rootRoute } from './root.tsx';

/** A TV opens on pairing until it has a mode. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: UnpairedScreen });
