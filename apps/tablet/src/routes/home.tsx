import { createRoute } from '@tanstack/react-router';
import { HandEntryScreen } from '../features/hand-entry/index.ts';
import { rootRoute } from './root.tsx';

/** The tablet opens on hand entry. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HandEntryScreen });
