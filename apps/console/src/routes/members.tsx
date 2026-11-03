import { createRoute, useNavigate } from '@tanstack/react-router';
import { MembersScreen } from '../features/members/index.ts';
import { frameRoute } from './frame.tsx';

/** The record open and its part, in the address (console v3): `?member=…&part=…`. */
function recordSearch(search: Record<string, unknown>): { member?: string; part?: string } {
  const { member, part } = search;
  return { ...(typeof member === 'string' ? { member } : {}), ...(typeof part === 'string' ? { part } : {}) };
}

/** Members (#60): find a member and open their record (console v3: docked beside the list, in the address). */
export const membersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/members', validateSearch: recordSearch, component: MembersRoute });

function MembersRoute() {
  const { member, part } = membersRoute.useSearch();
  const navigate = useNavigate();
  return <MembersScreen memberId={member} part={part} onNavigate={(href) => void navigate({ href })} />;
}
