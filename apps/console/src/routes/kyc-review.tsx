import { createRoute } from '@tanstack/react-router';
import { KycReviewScreen } from '../features/kyc-review/index.ts';
import { frameRoute } from './frame.tsx';

/** The member to check in person, by name: the waitlist's Check ID opens the check with it (decision 0503). */
function checkSearch(search: Record<string, unknown>): { check?: string } {
  const { check } = search;
  return typeof check === 'string' && check.trim() !== '' ? { check } : {};
}

/** Identity checks waiting for a KYC reviewer, and the check in person (`?check=<name>` opens it for that member). */
export const kycReviewRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/kyc-review', validateSearch: checkSearch, component: KycReviewRoute,
});

function KycReviewRoute() {
  const { check } = kycReviewRoute.useSearch();
  return <KycReviewScreen checkName={check} />;
}
