import { createRoute } from '@tanstack/react-router';
import { MembersScreen } from '../features/members/index.ts';
import { frameRoute } from './frame.tsx';

/** `?member=<id>`: the member the search chose, for the screen to open their record. */
function membersSearchFrom(search: Record<string, unknown>): { member?: string } {
  return typeof search['member'] === 'string' ? { member: search['member'] } : {};
}

/** Members (#60): find a member and open their record. */
export const membersRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/members', validateSearch: membersSearchFrom, component: MembersScreen,
});
