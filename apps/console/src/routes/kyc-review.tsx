import { createRoute } from '@tanstack/react-router';
import { KycReviewScreen } from '../features/kyc-review/index.ts';
import { frameRoute } from './frame.tsx';

/** Identity checks waiting for a KYC reviewer. */
export const kycReviewRoute = createRoute({ getParentRoute: () => frameRoute, path: '/kyc-review', component: KycReviewScreen });
