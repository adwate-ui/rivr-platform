import { useKycReviewQueue, useStaffVenue, type KycCheck } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Screen, Stack, StaleNotice, Text } from '@rivr/ui';
import { checkGroups } from './checkText.ts';
import { InPersonSection } from './InPersonSection.tsx';
import { KycCheckCard } from './KycCheckCard.tsx';

/**
 * KYC review, for KYC reviewers (`kyc.review`) at the venue the console works in, with checks in person; and for hosts and
 * the floor, who check members in person (`kyc.in_person`, decision 0301) and review nothing, the check in person alone.
 */
export function KycReviewScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, permissions } = staff.venue;
  // Reopening a refused check done in person is a super admin's (#267).
  if (permissions.includes('kyc.review')) return <ReviewQueue venueId={venueId} canReopen={permissions.includes('members.override_features')} />;
  if (permissions.includes('kyc.in_person')) return <Screen title={t('console.kycReview.title')}><InPersonSection venueId={venueId} /></Screen>;
  return <Screen title={t('console.kycReview.title')} status="error" errorText={t('console.kycReview.notAllowed')} />;
}

/** One group of checks under its heading, or nothing when there are none. */
function CheckGroup({ venueId, heading, checks, canReopen }: { venueId: string; heading: string; checks: readonly KycCheck[]; canReopen: boolean }) {
  if (checks.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{heading}</Heading>
      <Stack gap={6} divided>
        {checks.map((check) => <KycCheckCard key={check.memberId} venueId={venueId} check={check} canReopen={canReopen} />)}
      </Stack>
    </Stack>
  );
}

/** A check in person first, then the checks to review, then those waiting on the member and those refused, which need no decision. */
function ReviewQueue({ venueId, canReopen }: { venueId: string; canReopen: boolean }) {
  const queue = useKycReviewQueue(venueId);
  const title = t('console.kycReview.title');
  // A failed refresh keeps the queue and any decision half typed, with a notice, rather than swapping them for an error.
  if (queue.data === undefined) {
    return queue.isError ? <Screen title={title} status="error" onRetry={() => void queue.refetch()} /> : <Screen title={title} status="loading" />;
  }
  const groups = checkGroups(queue.data);
  return (
    <Screen title={title}>
      <Stack gap={10}>
        {queue.isError ? <StaleNotice since={new Date(queue.dataUpdatedAt)} onRetry={() => void queue.refetch()} /> : null}
        <InPersonSection venueId={venueId} />
        {groups.toReview.length === 0 ? <Text tone="muted">{t('console.kycReview.empty')}</Text> : null}
        <CheckGroup venueId={venueId} heading={t('console.kycReview.waiting')} checks={groups.toReview} canReopen={canReopen} />
        <CheckGroup venueId={venueId} heading={t('console.kycReview.onMember')} checks={groups.onMember} canReopen={canReopen} />
        <CheckGroup venueId={venueId} heading={t('console.kycReview.refused')} checks={groups.refused} canReopen={canReopen} />
      </Stack>
    </Screen>
  );
}
