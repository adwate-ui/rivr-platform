import { createRoute } from '@tanstack/react-router';
import { CamerasScreen } from '../features/cameras/index.ts';
import { frameRoute } from './frame.tsx';

/** The venue's CCTV cameras: each over a table, on the cage or elsewhere (#122). */
export const camerasRoute = createRoute({ getParentRoute: () => frameRoute, path: '/cameras', component: CamerasScreen });
