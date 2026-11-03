import { useKycReviewQueue, useStaffVenue, type KycCheck } from '@rivr/db';
import { t } from '@rivr/i18n';
import { PickList, Screen, SplitView, Stack, StaleNotice } from '@rivr/ui';
import { useState } from 'react';
import { checkGroups, queueGroups } from './checkText.ts';
import { InPersonSection } from './InPersonSection.tsx';
import { InPersonSheet } from './InPersonSheet.tsx';
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

/** The check open: the one chosen while it is still in the queue, otherwise the first waiting for review. */
function openCheck(checks: readonly KycCheck[], chosenId: string | null): KycCheck | null {
  return checks.find((check) => check.memberId === chosenId) ?? checkGroups(checks).toReview[0] ?? null;
}

/**
 * The queue down the left and the check open on the right, half each (console v3); on a phone the check is a view of its
 * own with the way back. Check in person, the screen's one gold button, opens its sheet.
 */
function ReviewQueue({ venueId, canReopen }: { venueId: string; canReopen: boolean }) {
  const queue = useKycReviewQueue(venueId);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const title = t('console.kycReview.title');
  const actions = <InPersonSheet venueId={venueId} />;
  // A failed refresh keeps the queue and any decision half typed, with a notice, rather than swapping them for an error.
  if (queue.data === undefined) {
    return queue.isError
      ? <Screen title={title} actions={actions} status="error" onRetry={() => void queue.refetch()} />
      : <Screen title={title} actions={actions} status="loading" loadingLook="rows" />;
  }
  const open = openCheck(queue.data, chosenId);
  return (
    <Screen title={title} actions={actions}>
      <Stack gap={4}>
        {queue.isError ? <StaleNotice since={new Date(queue.dataUpdatedAt)} onRetry={() => void queue.refetch()} /> : null}
        <SplitView layout="even" backLabel={t('console.kycReview.back')} onBack={() => setChosenId(null)}
          isChosen={open !== null && open.memberId === chosenId}
          list={<PickList label={t('console.kycReview.queue')} groups={queueGroups(queue.data)} current={open?.memberId ?? null}
            onPick={setChosenId} emptyText={t('console.kycReview.empty')} />}
          detail={open === null ? null : (
            <KycCheckCard key={open.memberId} venueId={venueId} check={open} canReopen={canReopen} onDecided={() => setChosenId(open.memberId)} />
          )} />
      </Stack>
    </Screen>
  );
}
