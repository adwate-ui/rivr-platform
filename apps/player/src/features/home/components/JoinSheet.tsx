import { useControlState, useFeature, useRestrictions, useWaitlistActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { formatDateTime, formatDuration, formatMoney, formatStakes, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, haptic, Sheet, StatRow, Text, useIsOnline, useToast } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/**
 * The join's one button, Request a seat (players see neither seats nor the wait, owner 8 Nov), or paused; busy while it
 * goes. On a break (decision 0300) there is none, only until when, as the club would refuse the join.
 */
function JoinButton({ onJoin, isJoining }: { onJoin: () => void; isJoining: boolean }) {
  const { isVenueFrozen } = useControlState();
  const breakUntil = useRestrictions().data?.breakUntil ?? null;
  const isOnline = useIsOnline();
  if (breakUntil !== null) return <Text tone="muted" align="center">{t('player.tonight.breakActive', { until: formatDateTime(new Date(breakUntil)) })}</Text>;
  return (
    <Button variant="primary" size="tall" fullWidth isDisabled={isVenueFrozen || !isOnline} isLoading={isJoining} onClick={onJoin}>
      {isVenueFrozen ? t('player.live.join.paused') : t('player.live.join.request')}
    </Button>
  );
}

/** The open sheet: the table's stakes, its minimum buy-in and call time, and Request a seat. */
function OpenJoinSheet({ table, onClose }: { table: FloorTable; onClose: () => void }) {
  const access = useFeature('waitlist.join');
  const { joinAt, leave } = useWaitlistActions();
  const toast = useToast();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
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
      title={`${t(`player.live.games.${table.game}`)} ${formatStakes(table.smallBlind, table.bigBlind, table.straddle)}`}>
      <StatRow size="medium" stats={[
        { label: t('player.live.join.minBuyIn'), value: formatMoney(table.buyIn) },
        { label: t('player.live.join.callTime'), value: formatDuration(table.callTimeMinutes * 60) },
      ]} />
      <FeatureGate access={access}>
        <JoinButton isJoining={joinAt.isPending} onJoin={() => void join()} />
      </FeatureGate>
      {failure === null ? null : <ErrorMessage look="dot">{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
    </Sheet>
  );
}

/**
 * Joining at a table (brief 3.4 B, decision 0321): the table's name, its game and stakes with any straddle, its minimum
 * buy-in and call time, and one button; never its seats or the wait (owner, 8 Nov). A join is a request the floor approves
 * onto this table's list; it says so with a toast and Undo, and the phone buzzes. Feature waitlist.join.
 */
export function JoinSheet({ table, onClose }: { table: FloorTable | null; onClose: () => void }) {
  return table === null ? null : <OpenJoinSheet table={table} onClose={onClose} />;
}
