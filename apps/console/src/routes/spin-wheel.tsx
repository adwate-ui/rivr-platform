import { createRoute } from '@tanstack/react-router';
import { SpinWheelScreen } from '../features/spin-wheel/index.ts';
import { frameRoute } from './frame.tsx';

/** The spin wheel: the spins waiting, and the wheel's prizes and odds (#150). */
export const spinWheelRoute = createRoute({ getParentRoute: () => frameRoute, path: '/spin-wheel', component: SpinWheelScreen });
