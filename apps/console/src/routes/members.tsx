import { createRoute } from '@tanstack/react-router';
import { MembersScreen } from '../features/members/index.ts';
import { frameRoute } from './frame.tsx';

/** Members (#60): find a member and open their record. */
export const membersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/members', component: MembersScreen });
