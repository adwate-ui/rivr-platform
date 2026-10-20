import { createRoute } from '@tanstack/react-router';
import { SopsScreen } from '../features/sops/index.ts';
import { frameRoute } from './frame.tsx';

/** The SOP library: read and acknowledge; managers add SOPs and publish versions (#51). */
export const sopsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/sops', component: SopsScreen });
