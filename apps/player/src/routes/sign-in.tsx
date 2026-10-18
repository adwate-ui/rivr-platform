import { createRoute } from '@tanstack/react-router';
import { SignInScreen } from '../features/sign-in/index.ts';
import { rootRoute } from './root.tsx';

/** Sign-in: full screen, outside the frame's tabs. */
export const signInRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sign-in', component: SignInScreen });
