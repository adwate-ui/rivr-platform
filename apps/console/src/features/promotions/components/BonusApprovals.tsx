import { LIST_PAGE, useDecideBonus, useListChoices, useWaitingBonusPage, type BonusDecision, type BonusDecisionFailure, type ListChoices, type WaitingBonus } from '@rivr/db';
import { sum } from '@rivr/domain/money';
import { formatChips, formatDayTime, formatDuration, t } from '@rivr/i18n';
import { BulkBar, Button, ConfirmQuestion, DataTable, ErrorMessage, Inline, Stack, useToast, type DataTableColumn, type DataTableRequest } from '@rivr/ui';
import { useState } from 'react';
import { RefuseBonus } from './RefuseBonus.tsx';

const WHY_WORDS = ['signup', 'referral', 'check_in', 'hours_played'] as const;

/** What set a Bonus off: a seat names its table, play time the step reached, and an older rule's trigger reads as a promotion. */
function whyOf(bonus: WaitingBonus): string {
  if (bonus.trigger === 'seated') {
    return bonus.tableName === null ? t('console.promotions.approvals.why.seated') : t('console.promotions.approvals.why.seatedAt', { table: bonus.tableName });
  }
  if (bonus.trigger === 'hours_step') {
    return bonus.stepMinutes === null ? t('console.promotions.approvals.why.hours_step') : t('console.promotions.approvals.why.hoursStep', { time: formatDuration(bonus.stepMinutes * 60) });
  }
  const known = WHY_WORDS.find((word) => word === bonus.trigger);
  return known === undefined ? t('console.promotions.approvals.why.other') : t(`console.promotions.approvals.why.${known}`);
}

const memberOf = (bonus: WaitingBonus) => t('console.promotions.approvals.member', { name: bonus.fullName, number: bonus.memberNumber });
const amountOf = (bonus: WaitingBonus) => formatChips(bonus.amount);

/** One Bonus's own buttons: Approve it, or Refuse it in the panel. */
interface RowSteps {
  readonly isBusy: boolean;
  readonly approve: (ids: readonly string[]) => void;
  readonly refuse: (ids: readonly string[]) => void;
}

function Decide({ bonus, steps }: { bonus: WaitingBonus; steps: RowSteps }) {
  const named = { amount: amountOf(bonus), name: bonus.fullName };
  return (
    <Inline gap={1} justify="end">
      <Button variant="subtle" size="compact" isDisabled={steps.isBusy} aria-label={t('console.promotions.approvals.approveNamed', named)}
        onClick={() => steps.approve([bonus.grantId])}>{t('console.promotions.approvals.approve')}</Button>
      <Button variant="text" size="compact" isDisabled={steps.isBusy} aria-label={t('console.promotions.approvals.refuseNamed', named)}
        onClick={() => steps.refuse([bonus.grantId])}>{t('console.promotions.approvals.refuse')}</Button>
    </Inline>
  );
}

/** The table's columns: Promotion's menu holds the server's counts, and When filters by the club day. */
function columnsOf(counted: ListChoices | undefined, steps: RowSteps): readonly DataTableColumn<WaitingBonus>[] {
  return [
    { key: 'member', header: t('console.promotions.approvals.columns.member'), priority: 'primary', sortValue: (bonus) => bonus.fullName, cell: memberOf, filter: 'text' },
    {
      key: 'promotion', header: t('console.promotions.approvals.columns.promotion'), filter: 'choice', choices: counted?.['promotion'] ?? [],
      filterValue: (bonus) => bonus.promotionName, sortValue: (bonus) => bonus.promotionName, cell: (bonus) => bonus.promotionName,
    },
    { key: 'amount', header: t('console.promotions.approvals.columns.amount'), align: 'end', filter: false, sortValue: (bonus) => bonus.amount, cell: amountOf },
    { key: 'why', header: t('console.promotions.approvals.columns.why'), filter: false, cell: whyOf },
    { key: 'when', header: t('console.promotions.approvals.columns.when'), filter: 'date', sortValue: (bonus) => bonus.eventAt, cell: (bonus) => formatDayTime(new Date(bonus.eventAt)) },
    { key: 'decide', header: t('console.promotions.approvals.columns.decide'), align: 'end', filter: false, cell: (bonus) => <Decide bonus={bonus} steps={steps} /> },
  ];
}

/** The table's state: loading, failed with a retry, or the page's rows. */
function stateOf(list: ReturnType<typeof useWaitingBonusPage>) {
  if (list.data !== undefined) return { rows: list.data.rows, emptyText: t('console.promotions.approvals.empty') };
  return list.isError ? { status: 'error' as const, onRetry: () => void list.refetch() } : { status: 'loading' as const };
}

/** What an approval did: how many and how much, any frozen member's left waiting, or that another super admin had decided them. */
function saidOf({ grants, amount, leftWaiting }: BonusDecision): string {
  if (grants === 0 && leftWaiting === 0) return t('console.promotions.approvals.alreadyDecided');
  const approved = { count: grants, amount: formatChips(amount) };
  return leftWaiting === 0 ? t('console.promotions.approvals.approved', approved) : t('console.promotions.approvals.approvedLeft', { ...approved, left: leftWaiting });
}

/**
 * Approves the Bonus given and says what it did. The same Bonus keeps one request id until it goes through, so a retry after
 * a lost reply is the same request, answered with its first try.
 */
function useApprove(venueId: string, onDone: () => void) {
  const decide = useDecideBonus(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<BonusDecisionFailure | null>(null);
  const [pending, setPending] = useState<{ readonly key: string; readonly requestId: string } | null>(null);
  const approve = async (ids: readonly string[]) => {
    const key = ids.join(' ');
    const requestId = pending?.key === key ? pending.requestId : crypto.randomUUID();
    setPending({ key, requestId });
    const outcome = await decide.mutateAsync({ grantIds: ids, requestId, refusal: null });
    setFailure(outcome.ok ? null : outcome.error);
    // Only a reply lost on the way keeps the request for a retry.
    if (outcome.ok || outcome.error !== 'unavailable') setPending(null);
    if (!outcome.ok) return;
    toast(saidOf(outcome.value));
    onDone();
  };
  return { approve, failure, isBusy: decide.isPending };
}

/** The question before Bonus is approved in bulk, ticked or all shown: how many and how much. One row's Approve asks nothing. */
function ApproveQuestion({ asking, isBusy, onConfirm, onCancel }: { asking: readonly WaitingBonus[]; isBusy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const total = formatChips(sum(asking.map((bonus) => bonus.amount)));
  return (
    <ConfirmQuestion question={t('console.promotions.approvals.confirmApprove', { count: asking.length, amount: total })}
      confirm={t('console.promotions.approvals.confirmApproveYes', { count: asking.length })} isBusy={isBusy} onConfirm={onConfirm} onCancel={onCancel} />
  );
}

interface QueueActionsProps {
  venueId: string;
  shown: readonly WaitingBonus[];
  ticked: readonly string[];
  decision: ReturnType<typeof useApprove>;
  refusing: readonly string[] | null;
  setRefusing: (ids: readonly string[] | null) => void;
  onDone: () => void;
}

/** Over the table: the bar of the ones ticked, Approve all shown, the question before a bulk approval, and the refusal's panel. */
function QueueActions({ venueId, shown, ticked, decision, refusing, setRefusing, onDone }: QueueActionsProps) {
  const [asking, setAsking] = useState<readonly WaitingBonus[] | null>(null);
  const confirm = (bonuses: readonly WaitingBonus[]) => {
    setAsking(null);
    void decision.approve(bonuses.map((bonus) => bonus.grantId));
  };
  return (
    <>
      <BulkBar count={ticked.length} onClear={onDone} actions={[
        { id: 'approve', label: t('console.promotions.approvals.approve'), onClick: () => setAsking(shown.filter((bonus) => ticked.includes(bonus.grantId))), isMain: true },
        { id: 'refuse', label: t('console.promotions.approvals.refuse'), onClick: () => setRefusing(ticked) },
      ]} />
      {shown.length === 0 ? null : (
        <Inline justify="end">
          <Button variant="subtle" size="compact" isLoading={decision.isBusy} onClick={() => setAsking(shown)}>{t('console.promotions.approvals.approveShown')}</Button>
        </Inline>
      )}
      {asking === null || asking.length === 0 ? null : (
        <ApproveQuestion asking={asking} isBusy={decision.isBusy} onCancel={() => setAsking(null)} onConfirm={() => confirm(asking)} />
      )}
      {decision.failure === null ? null : <ErrorMessage>{t(`console.promotions.approvals.failures.${decision.failure}`)}</ErrorMessage>}
      {refusing === null || refusing.length === 0 ? null : <RefuseBonus venueId={venueId} ids={refusing} onDone={onDone} onCancel={() => setRefusing(null)} />}
    </>
  );
}

/**
 * Bonus to approve (decision 0670): every Bonus a promotion calculated, waiting for a super admin, a page at a time from the
 * server, the oldest first, searched by member or promotion and filtered by promotion and day. Approve one, the ones ticked
 * or all shown; refuse one or the ones ticked with a reason. A row opens the member's record.
 */
export function BonusApprovals({ venueId, onNavigate, exportIn }: { venueId: string; onNavigate: (href: string) => void; exportIn: HTMLElement | null }) {
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const list = useWaitingBonusPage(venueId, request);
  const counted = useListChoices('bonus_waiting', venueId, request).data;
  const [selected, setSelected] = useState<string[]>([]);
  const [refusing, setRefusing] = useState<readonly string[] | null>(null);
  const clear = () => {
    setSelected([]);
    setRefusing(null);
  };
  const decision = useApprove(venueId, clear);
  const shown = list.data?.rows ?? [];
  // A Bonus another super admin has decided since is no longer sent.
  const ticked = selected.filter((id) => shown.some((bonus) => bonus.grantId === id));
  const steps: RowSteps = { isBusy: decision.isBusy, approve: (ids) => void decision.approve(ids), refuse: setRefusing };
  const search = { label: t('console.promotions.approvals.search'), variant: 'subtle' as const, text: (bonus: WaitingBonus) => `${bonus.fullName} ${bonus.promotionName}` };
  return (
    <Stack gap={3}>
      <QueueActions venueId={venueId} shown={shown} ticked={ticked} decision={decision} refusing={refusing} setRefusing={setRefusing} onDone={clear} />
      <DataTable {...stateOf(list)} label={t('console.promotions.approvals.label')} columns={columnsOf(counted, steps)} rowKey={(bonus) => bonus.grantId}
        filter={search} exportIn={exportIn}
        server={{ total: list.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest }} exportRows={list.readEvery}
        selection={{ selected, onChange: setSelected }} onRowOpen={(bonus) => onNavigate(`/members?member=${encodeURIComponent(bonus.memberId)}`)} />
    </Stack>
  );
}
