import { createRoute, useNavigate } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { FnbScreen } from '../features/fnb/index.ts';
import { frameRoute } from './frame.tsx';

/** Table-side food and drink (#123, console v3): Orders and Menu, by tab (`?tab=orders`, `?tab=menu`). */
export const fnbRoute = createRoute({ getParentRoute: () => frameRoute, path: '/fnb', validateSearch: tabSearchFrom, component: FnbRoute });

function FnbRoute() {
  const { tab } = fnbRoute.useSearch();
  const navigate = useNavigate();
  return <FnbScreen tab={tab} onNavigate={(href) => void navigate({ href })} />;
}
