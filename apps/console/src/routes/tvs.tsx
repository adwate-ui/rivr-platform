import { createRoute } from '@tanstack/react-router';
import { TvScreensScreen } from '../features/tv-screens/index.ts';
import { frameRoute } from './frame.tsx';

/** The venue's TVs: pair one by the code it shows, change what it shows, unpair it (#49). */
export const tvsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tvs', component: TvScreensScreen });
