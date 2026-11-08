import { createRoute } from '@tanstack/react-router';
import { useNavigateKeepingViews } from '../features/frame/index.ts';
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
  // The list's own search and tier, and its table's view, stay as a record opens (owner, 9 Nov).
  const navigate = useNavigateKeepingViews(['q', 'tier']);
  return <MembersScreen memberId={member} part={part} onNavigate={navigate} />;
}
