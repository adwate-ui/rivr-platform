import { createRoute } from '@tanstack/react-router';
import { RosterScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** The roster (#106): shifts by job title for a week, and tonight's attendance. */
export const rosterRoute = createRoute({ getParentRoute: () => frameRoute, path: '/roster', component: RosterScreen });
