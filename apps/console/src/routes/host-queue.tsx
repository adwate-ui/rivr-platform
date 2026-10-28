import { createRoute } from '@tanstack/react-router';
import { HostQueueScreen } from '../features/host-queue/index.ts';
import { frameRoute } from './frame.tsx';

/** The host queue: lapsed regulars to call, why they stopped coming, and the offer made (#165). */
export const hostQueueRoute = createRoute({ getParentRoute: () => frameRoute, path: '/host-queue', component: HostQueueScreen });
