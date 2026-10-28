import { createRoute } from '@tanstack/react-router';
import { WebsiteScreen } from '../features/website/index.ts';
import { frameRoute } from './frame.tsx';

/** The website editor: drafts, preview, scheduled publish, history and rollback (#129). */
export const websiteRoute = createRoute({ getParentRoute: () => frameRoute, path: '/website', component: WebsiteScreen });
