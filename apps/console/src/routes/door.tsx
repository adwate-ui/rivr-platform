import { createRoute, useNavigate } from '@tanstack/react-router';
import { DoorScreen } from '../features/door/index.ts';
import { tabSearchFrom } from '../features/frame/index.ts';
import { frameRoute } from './frame.tsx';

/** The door (console v3): Check-in and Today's players, by tab (`?tab=checkin`, `?tab=today`). */
export const doorRoute = createRoute({ getParentRoute: () => frameRoute, path: '/door', validateSearch: tabSearchFrom, component: DoorRoute });

function DoorRoute() {
  const { tab } = doorRoute.useSearch();
  const navigate = useNavigate();
  return <DoorScreen tab={tab} onNavigate={(href) => void navigate({ href })} />;
}
