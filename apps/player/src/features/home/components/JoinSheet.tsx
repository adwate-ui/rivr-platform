import { useControlState, useFeature, useFloorTakenSeats, useRestrictions, useWaitlistActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { formatDateTime, formatDuration, formatStakes, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, haptic, SeatMap, Sheet, Skeleton, StatRow, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** The seats no one sits in nor is held for, numbered from 1. */
function openSeatsOf(table: FloorTable, taken: readonly number[]): number[] {
  return Array.from({ length: table.seats }, (_, index) => index + 1).filter((seat) => !taken.includes(seat));
}

/**
 * The join's one button: paused, Take a seat with seats and no wait, else Join waitlist; busy while it goes. On a break
 * (decision 0300) there is none, only until when, as the club would refuse the join.
 */
function JoinButton({ table, openCount, onJoin, isJoining }: { table: FloorTable; openCount: number; onJoin: () => void; isJoining: boolean }) {
  const { isVenueFrozen } = useControlState();
  const breakUntil = useRestrictions().data?.breakUntil ?? null;
  if (breakUntil !== null) return <Text tone="muted" align="center">{t('player.tonight.breakActive', { until: formatDateTime(new Date(breakUntil)) })}</Text>;
  const label = isVenueFrozen ? t('player.live.join.paused')
    : openCount > 0 && table.waiting === 0 ? t('player.live.join.takeSeat') : t('player.live.join.joinWaitlist');
  return (
    <Button variant="primary" size="tall" fullWidth isDisabled={isVenueFrozen} isLoading={isJoining} onClick={onJoin}>{label}</Button>
  );
}

/** The seat map and the table's figures once the taken seats are in; a skeleton until then, as no seat is guessed open. */
function TableFigures({ table, open }: { table: FloorTable; open: readonly number[] | null }) {
  if (open === null) return <Skeleton rows={2} />;
  return (
    <>
      <SeatMap seatCount={table.seats} openSeats={[...open]} label={t('player.live.join.seatMap', { open: open.length, seats: table.seats })} />
      <StatRow size="medium" stats={[
        { label: t('player.live.join.seatsOpen'), value: t('player.live.join.seatsOf', { open: open.length, seats: table.seats }) },
        { label: t('player.live.join.waiting'), value: table.waiting === 0 ? t('player.live.join.none') : String(table.waiting) },
        { label: t('player.live.join.callTime'), value: formatDuration(table.callTimeMinutes * 60) },
      ]} />
    </>
  );
}

/** The open sheet: its reads (the taken seats, asked again while it is open) start only once a table is opened. */
function OpenJoinSheet({ table, onClose }: { table: FloorTable; onClose: () => void }) {
  const access = useFeature('waitlist.join');
  const taken = useFloorTakenSeats().data;
  const { joinAt, leave } = useWaitlistActions();
  const toast = useToast();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const open = taken === undefined ? null : openSeatsOf(table, taken.get(table.id) ?? []);
  const join = async () => {
    const joined = await joinAt.mutateAsync({ tableId: table.id, requestId });
    setFailure(joined.ok ? null : joined.error);
    if (!joined.ok) return;
    setRequestId(crypto.randomUUID());
    haptic();
    onClose();
    toast(t('player.live.list.joinedToast'), { onUndo: () => void leave.mutateAsync(joined.value) });
  };
  return (
    <Sheet isOpen onClose={onClose} eyebrow={table.name}
      title={`${t(`player.live.games.${table.game}`)} ${formatStakes(table.smallBlind, table.bigBlind)}`}>
      <TableFigures table={table} open={open} />
      <FeatureGate access={access}>
        <JoinButton table={table} openCount={open?.length ?? table.openSeats ?? 0} isJoining={joinAt.isPending} onJoin={() => void join()} />
      </FeatureGate>
      {failure === null ? null : <ErrorMessage look="dot">{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
    </Sheet>
  );
}

/**
 * Joining at a table (brief 3.4 B, decision 0321): the table's name, its game and stakes, the seat map (display only: the
 * floor seats), seats open, the wait on this table's own list (decision 0467) and the call time, and one button. A join is a
 * request the floor approves onto this table's list; it says so with a toast and Undo, and the phone buzzes. Feature
 * waitlist.join.
 */
export function JoinSheet({ table, onClose }: { table: FloorTable | null; onClose: () => void }) {
  return table === null ? null : <OpenJoinSheet table={table} onClose={onClose} />;
}
