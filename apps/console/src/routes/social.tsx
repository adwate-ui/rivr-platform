import { createRoute } from '@tanstack/react-router';
import { SocialScreen } from '../features/social/index.ts';
import { frameRoute } from './frame.tsx';

/** Social: publishing, and the social wall's moderation (#154, #157). */
export const socialRoute = createRoute({ getParentRoute: () => frameRoute, path: '/social', component: SocialScreen });
