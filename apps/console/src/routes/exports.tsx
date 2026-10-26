import { createRoute } from '@tanstack/react-router';
import { ExportsScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** Exports (#103): the venue's full archive and one member's data, for super admins. */
export const exportsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/exports', component: ExportsScreen });
