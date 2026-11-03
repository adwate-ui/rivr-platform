import { createRoute, useNavigate } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { SocialScreen } from '../features/social/index.ts';
import { frameRoute } from './frame.tsx';

/** Social (#154, #157, #587): the social wall, publishing and the inbox's leads, by tab (console v3). */
export const socialRoute = createRoute({ getParentRoute: () => frameRoute, path: '/social', validateSearch: tabSearchFrom, component: SocialRoute });

function SocialRoute() {
  const { tab } = socialRoute.useSearch();
  const navigate = useNavigate();
  return <SocialScreen tab={tab} onNavigate={(href) => void navigate({ href })} />;
}
