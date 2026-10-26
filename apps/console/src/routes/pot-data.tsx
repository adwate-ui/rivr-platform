import { createRoute } from '@tanstack/react-router';
import { PotDataScreen } from '../features/pot-data/index.ts';
import { frameRoute } from './frame.tsx';

/** Every hand by table, dealer, variant and period, for the super admin (#114, decision 0185). */
export const potDataRoute = createRoute({ getParentRoute: () => frameRoute, path: '/pot-data', component: PotDataScreen });
