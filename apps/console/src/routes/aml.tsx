import { createRoute } from '@tanstack/react-router';
import { AmlScreen } from '../features/aml/index.ts';
import { frameRoute } from './frame.tsx';

/** The AML register (#105): patterns in members' cash buy-ins, and their review. */
export const amlRoute = createRoute({ getParentRoute: () => frameRoute, path: '/aml', component: AmlScreen });
