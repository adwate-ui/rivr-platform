import { createRoute, useNavigate } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { FeedbackScreen } from '../features/feedback/index.ts';
import { frameRoute } from './frame.tsx';

/** The General Manager's feedback tickets (#160, decision 0165), Open and Resolved by tab (console v3). */
export const feedbackRoute = createRoute({ getParentRoute: () => frameRoute, path: '/feedback', validateSearch: tabSearchFrom, component: FeedbackRoute });

function FeedbackRoute() {
  const { tab } = feedbackRoute.useSearch();
  const navigate = useNavigate();
  return <FeedbackScreen tab={tab} onNavigate={(href) => void navigate({ href })} />;
}
