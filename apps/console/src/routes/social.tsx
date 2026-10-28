import { createRoute } from '@tanstack/react-router';
import { SocialScreen } from '../features/social/index.ts';
import { frameRoute } from './frame.tsx';

/** Social: publishing, the inbox's leads, and the social wall's moderation (#154, #157, #587). */
export const socialRoute = createRoute({ getParentRoute: () => frameRoute, path: '/social', component: SocialScreen });
