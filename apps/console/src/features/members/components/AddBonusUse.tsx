import { useAddBonusUse, useBonusUseSeats, type BonusUseSeat, type CorrectBonusFailure } from '@rivr/db/bonus';
import { formatDateTime, formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, ConfirmButton, ErrorMessage, Heading, Input, LoadState, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { chipsFrom } from './GiveBonusChips.tsx';

/** A seat in words: `Table 5 · seat 7 · 18 Nov 2026, 22:10`. */
const seatLine = (seat: BonusUseSeat) =>
  t('console.members.bonus.missedUse.seatLine', { table: seat.tableName, seat: String(seat.seat), when: formatDateTime(new Date(seat.startedAt)) });

type Outcome = { readonly added: number } | { readonly failure: CorrectBonusFailure } | null;

/** Seats shown at first, and how many more each Show earlier adds. */
const PAGE = 10;

interface SeatChoiceProps {
  readonly seats: ReturnType<typeof useBonusUseSeats>;
  readonly count: number;
  readonly sessionId: string | null;
  readonly onPick: (id: string | null) => void;
  readonly onMore: () => void;
}

/** The member's seats to choose from, the newest first, `count` read at a time, or their loading, error or empty state. */
function SeatChoice({ seats, count, sessionId, onPick, onMore }: SeatChoiceProps) {
  if (seats.isError) return <LoadState isError onRetry={() => void seats.refetch()} />;
  if (seats.data === undefined) return <LoadState />;
  if (seats.data.length === 0) return <Text tone="muted">{t('console.members.bonus.missedUse.noSeats')}</Text>;
  return (
    <Stack gap={2}>
      <ChoiceChips label={t('console.members.bonus.missedUse.seat')} mode="one" look="subtle" options={seats.data.map((seat) => ({ value: seat.sessionId, label: seatLine(seat) }))}
        selected={sessionId === null ? [] : [sessionId]} onChange={([chosen]) => onPick(chosen ?? null)} />
      {seats.data.length < count ? null : <Button variant="text" size="small" onClick={onMore}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}

/**
 * A Bonus use a seat missed, added by a super admin (#1077, the owner, 18 Nov): any seat of the member's, from any visit
 * (the owner, 19 Nov), whole fifties and a reason kept on the record, asked twice. It counts on that seat's day, with no visit limit, and may take the balance below
 * zero. One request id until it goes through, is refused or what is chosen changes, so pressing again never adds twice.
 */
export function AddBonusUse({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [count, setCount] = useState(PAGE);
  const seats = useBonusUseSeats(venueId, memberId, count);
  const add = useAddBonusUse(venueId, memberId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<Outcome>(null);
  const chips = chipsFrom(typed);
  const fresh = () => setRequestId(crypto.randomUUID());
  const submit = async () => {
    if (chips === null || sessionId === null) return;
    const done = await add.mutateAsync({ sessionId, chips, reason: reason.trim(), requestId });
    setOutcome(done.ok ? { added: chips } : { failure: done.error });
    if (done.ok || done.error !== 'unavailable') fresh();
    if (done.ok) { setTyped(''); setReason(''); setSessionId(null); }
  };
  return (
    <Stack as="section" aria-label={t('console.members.bonus.missedUse.title')} gap={3}>
      <Heading level={3}>{t('console.members.bonus.missedUse.title')}</Heading>
      <SeatChoice seats={seats} count={count} sessionId={sessionId} onPick={(id) => { setSessionId(id); fresh(); }} onMore={() => setCount(count + PAGE)} />
      <Input label={t('console.members.bonus.missedUse.chips')} hint={t('console.members.bonus.missedUse.chipsHint')} value={typed} inputMode="numeric"
        autoComplete="off" onChange={(event) => { setTyped(event.target.value); fresh(); }} />
      <Input label={t('console.members.bonus.missedUse.reason')} hint={t('console.members.bonus.missedUse.reasonHint')} value={reason} maxLength={200}
        autoComplete="off" onChange={(event) => { setReason(event.target.value); fresh(); }} />
      <Stack align="start">
        <ConfirmButton variant="subtle" label={t('console.members.bonus.missedUse.add')} isBusy={add.isPending}
          confirm={t('console.members.bonus.missedUse.confirm', { chips: formatNumber(chips ?? 0) })}
          isDisabled={sessionId === null || chips === null || reason.trim().length < 3} onConfirm={() => void submit()} />
      </Stack>
      <StatusMessage>{outcome !== null && 'added' in outcome ? t('console.members.bonus.missedUse.added', { chips: formatNumber(outcome.added) }) : null}</StatusMessage>
      {outcome !== null && 'failure' in outcome ? <ErrorMessage>{t(`console.members.bonus.missedUse.failures.${outcome.failure}`)}</ErrorMessage> : null}
    </Stack>
  );
}
