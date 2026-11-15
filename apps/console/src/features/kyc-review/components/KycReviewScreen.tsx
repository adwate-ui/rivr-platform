import { LIST_PAGE, useKycReviewPage, useListChoices, useStaffVenue, type KycCheck, type ListView } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Input, Pages, PickList, Screen, SplitView, Stack, StaleNotice } from '@rivr/ui';
import { useState } from 'react';
import { checkGroups, queueGroups } from './checkText.ts';
import { InPersonSection } from './InPersonSection.tsx';
import { InPersonSheet } from './InPersonSheet.tsx';
import { KycCheckCard } from './KycCheckCard.tsx';

/**
 * KYC review, for KYC reviewers (`kyc.review`) at the venue the console works in, with checks in person; and for hosts and
 * the floor, who check members in person (`kyc.in_person`, decision 0301) and review nothing, the check in person alone.
 * `checkName`, from the waitlist's Check ID (decision 0503), opens the check in person with that member searched.
 */
export function KycReviewScreen({ checkName }: { checkName?: string | undefined }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, permissions } = staff.venue;
  // Reopening a refused check done in person is a super admin's (#267).
  if (permissions.includes('kyc.review')) {
    return <ReviewQueue venueId={venueId} canReopen={permissions.includes('members.override_features')} checkName={checkName} />;
  }
  if (permissions.includes('kyc.in_person')) {
    return <Screen title={t('console.kycReview.title')}><InPersonSection venueId={venueId} initialSearch={checkName} /></Screen>;
  }
  return <Screen title={t('console.kycReview.title')} status="error" errorText={t('console.kycReview.notAllowed')} />;
}

/** The check open: the one chosen while it is still in the queue, otherwise the first waiting for review. */
function openCheck(checks: readonly KycCheck[], chosenId: string | null): KycCheck | null {
  return checks.find((check) => check.memberId === chosenId) ?? checkGroups(checks).toReview[0] ?? null;
}

/** The queue's own view: the name searched and the page, in the queue's order. */
function useQueueView(): { view: ListView; search: (typed: string) => void; setPage: (page: number) => void } {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  return {
    view: { sort: null, query, filters: {}, page },
    search: (typed) => {
      setQuery(typed);
      setPage(1);
    },
    setPage,
  };
}

/**
 * The queue down the left and the check open on the right, half each (console v3); on a phone the check is a view of its
 * own with the way back. The queue is a page of fifty from the server (redesign RD-30), found by name, its pages under it.
 * Check in person, the screen's one gold button, opens its sheet.
 */
function ReviewQueue({ venueId, canReopen, checkName }: { venueId: string; canReopen: boolean; checkName: string | undefined }) {
  const { view, search, setPage } = useQueueView();
  const queue = useKycReviewPage(venueId, view);
  const counted = useListChoices('kyc_review', venueId, view).data;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const title = t('console.kycReview.title');
  const actions = <InPersonSheet venueId={venueId} initialSearch={checkName} />;
  // A failed refresh keeps the queue and any decision half typed, with a notice, rather than swapping them for an error.
  if (queue.data === undefined) {
    return queue.isError
      ? <Screen title={title} actions={actions} status="error" onRetry={() => void queue.refetch()} />
      : <Screen title={title} actions={actions} status="loading" loadingLook="rows" />;
  }
  const { rows, total } = queue.data;
  const open = openCheck(rows, chosenId);
  const countOf = (status: KycCheck['status']) => counted?.['status']?.find((one) => one.value === status)?.count;
  const pages = Math.ceil(total / LIST_PAGE);
  const find = <Input type="search" label={t('console.kycReview.queueSearch')} value={view.query} autoComplete="off" onChange={(event) => search(event.target.value)} />;
  return (
    <Screen title={title} actions={actions}>
      <Stack gap={4}>
        {queue.isError ? <StaleNotice since={new Date(queue.dataUpdatedAt)} onRetry={() => void queue.refetch()} /> : null}
        <SplitView layout="even" backLabel={t('console.kycReview.back')} onBack={() => setChosenId(null)}
          isChosen={open !== null && open.memberId === chosenId}
          list={(
            <Stack gap={3}>
              <PickList label={t('console.kycReview.queue')} groups={queueGroups(rows, countOf)} current={open?.memberId ?? null}
                onPick={setChosenId} search={find} emptyText={view.query === '' ? t('console.kycReview.empty') : t('console.kycReview.noneFound')} />
              {pages > 1 ? <Pages label={t('console.kycReview.queue')} page={view.page} count={pages} onPage={setPage} /> : null}
            </Stack>
          )}
          detail={open === null ? null : (
            <KycCheckCard key={open.memberId} venueId={venueId} check={open} canReopen={canReopen} onDecided={() => setChosenId(open.memberId)} />
          )} />
      </Stack>
    </Screen>
  );
}
