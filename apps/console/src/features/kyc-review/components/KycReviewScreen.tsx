import { useKycReviewQueue, useStaffVenue, type KycCheck } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Screen, Stack, Text } from '@rivr/ui';
import { InPersonSection } from './InPersonSection.tsx';
import { KycCheckCard } from './KycCheckCard.tsx';

/** KYC review, for KYC reviewers (`kyc.review`) at the venue the console works in, and checks in person. */
export function KycReviewScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('kyc.review')) {
    return <Screen title={t('console.kycReview.title')} status="error" errorText={t('console.kycReview.notAllowed')} />;
  }
  return <ReviewQueue venueId={staff.venue.venueId} />;
}

/** One group of checks under its heading, or nothing when there are none. */
function CheckGroup({ venueId, heading, checks }: { venueId: string; heading: string; checks: readonly KycCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{heading}</Heading>
      <Stack gap={6} divided>
        {checks.map((check) => <KycCheckCard key={check.memberId} venueId={venueId} check={check} />)}
      </Stack>
    </Stack>
  );
}

/** A check in person first, then the checks waiting for review, then those stopped or refused, which need no decision. */
function ReviewQueue({ venueId }: { venueId: string }) {
  const queue = useKycReviewQueue(venueId);
  const title = t('console.kycReview.title');
  if (queue.isPending) return <Screen title={title} status="loading" />;
  if (queue.isError) return <Screen title={title} status="error" onRetry={() => void queue.refetch()} />;
  const waiting = queue.data.filter((check) => check.status === 'needs_review');
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <InPersonSection venueId={venueId} />
        {queue.data.length === 0 ? <Text tone="muted">{t('console.kycReview.empty')}</Text> : null}
        <CheckGroup venueId={venueId} heading={t('console.kycReview.waiting')} checks={waiting} />
        <CheckGroup venueId={venueId} heading={t('console.kycReview.others')} checks={queue.data.filter((check) => check.status !== 'needs_review')} />
      </Stack>
    </Screen>
  );
}
