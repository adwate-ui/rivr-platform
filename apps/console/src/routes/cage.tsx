import { createRoute } from '@tanstack/react-router';
import { CageScreen } from '../features/cage/index.ts';
import { frameRoute } from './frame.tsx';

/** The cage (#57): buy-ins by cash, UPI or wallet, and the tables' requests. */
export const cageRoute = createRoute({ getParentRoute: () => frameRoute, path: '/cage', component: CageScreen });
