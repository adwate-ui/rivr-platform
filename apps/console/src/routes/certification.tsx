import { createRoute } from '@tanstack/react-router';
import { CertificationScreen } from '../features/certification/index.ts';
import { frameRoute } from './frame.tsx';

/** The dealer and cashier certification quizzes, in the practice venue (#50). */
export const certificationRoute = createRoute({ getParentRoute: () => frameRoute, path: '/certification', component: CertificationScreen });
