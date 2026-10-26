import { createRoute } from '@tanstack/react-router';
import { FeedbackScreen } from '../features/feedback/index.ts';
import { frameRoute } from './frame.tsx';

/** The General Manager's feedback tickets (#160, decision 0165). */
export const feedbackRoute = createRoute({ getParentRoute: () => frameRoute, path: '/feedback', component: FeedbackScreen });
