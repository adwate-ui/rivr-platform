import { useFeature, useMySeat, useMySeatActions, type MySeat, type MySeatFailure } from '@rivr/db';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Box, Button, CallTimeTimer, ErrorMessage, FeatureGate, Grid, Heading, LockedNotice, Stack, Text, type FeatureAccess } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

/**
 * Beneath the seat's buttons, the full width: where the top-up stands until the floor resets it (#634), that the member
 * is on the Leaving list, and the notice for an action their tier shows locked.
 */
function SeatNotes({ seat, topUp, leaving }: { seat: MySeat; topUp: FeatureAccess; leaving: FeatureAccess }) {
  return (
    <>
      {topUp.state === 'enabled' && seat.topUp === 'requested' ? <Text variant="small" weight="medium">{t('player.tonight.topUpRequested')}</Text> : null}
      {topUp.state === 'enabled' && seat.topUp === 'in_progress' ? <Text variant="small" weight="medium">{t('player.tonight.topUpInProgress')}</Text> : null}
      {topUp.state === 'locked' ? <LockedNotice tiers={topUp.tiers} /> : null}
      {seat.isLeaving ? <Text variant="small" tone="muted">{t('player.tonight.onLeavingList')}</Text> : null}
      {!seat.isLeaving && leaving.state === 'locked' ? <LockedNotice tiers={leaving.tiers} /> : null}
    </>
  );
}

/**
 * What the member does from the seat (#634), two to a row (UI polish audit A-08): an hour more call time while it runs
 * (with call_time.view), a top-up (with table.top_up), food and drink to the seat (#123), and leaving. With call time
 * still owed, leaving puts them on the floor's Leaving list. Only buttons share the grid; their notes run beneath.
 */
function SeatActions({ seat }: { seat: MySeat }) {
  const callTime = useFeature('call_time.view');
  const topUp = useFeature('table.top_up');
  const leaving = useFeature('table.leave');
  const fnb = useFeature('fnb.table_side');
  const navigate = useNavigate();
  const { extend, leave, requestTopUp } = useMySeatActions();
  const [failure, setFailure] = useState<MySeatFailure | null>(null);
  const report = (outcome: { ok: true } | { ok: false; error: MySeatFailure }) => setFailure(outcome.ok ? null : outcome.error);
  return (
    <Stack gap={2}>
      <Grid columns={2} gap={2}>
        {(seat.callTimeLeft ?? 0) > 0 && callTime.state === 'enabled' ? (
          <Button variant="secondary" aria-label={t('player.tonight.extendCallTimeName')} isLoading={extend.isPending}
            onClick={() => void extend.mutateAsync().then(report)}>
            {t('player.tonight.extendCallTime')}
          </Button>
        ) : null}
        {topUp.state === 'enabled' && seat.topUp === null ? (
          <Button variant="secondary" isLoading={requestTopUp.isPending} onClick={() => void requestTopUp.mutateAsync().then(report)}>
            {t('player.tonight.requestTopUp')}
          </Button>
        ) : null}
        {fnb.state === 'enabled' ? (
          <Button variant="secondary" aria-label={t('player.fnb.orderName')} onClick={() => void navigate({ to: '/fnb' })}>{t('player.fnb.order')}</Button>
        ) : null}
        {leaving.state === 'enabled' && !seat.isLeaving ? (
          <Button variant="secondary" isLoading={leave.isPending} onClick={() => void leave.mutateAsync().then(report)}>{t('player.tonight.leaveSeat')}</Button>
        ) : null}
      </Grid>
      <SeatNotes seat={seat} topUp={topUp} leaving={leaving} />
      {failure === null ? null : <ErrorMessage>{t(`player.tonight.seatFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * While the member is seated (#78): their table and seat as the card's heading, always theirs to see as their waitlist
 * places are (decision 0057); since when and how long they have played, and their minimum session (decision 0300); the
 * call time left as the card's figure with call_time.view, or the locked notice; and what they do from the seat (#634).
 */
export function SeatNotice() {
  const seat = useMySeat().data ?? null;
  const callTime = useFeature('call_time.view');
  if (seat === null) return null;
  return (
    <Box surface="raised" padding={4} radius="md">
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2}>{t('player.tonight.seated', { table: seat.tableName, seat: seat.seat })}</Heading>
          <Text variant="small" tone="muted">{t('player.tonight.playingSince', {
            time: formatTime(new Date(seat.startedAt)), played: formatDuration(seat.playedSeconds),
          })}</Text>
          {callTime.state === 'enabled' && (seat.callTimeMinutes ?? 0) > 0 ? (
            <Text variant="small" tone="muted">{t('player.tonight.minimumSession', { time: formatDuration((seat.callTimeMinutes ?? 0) * 60) })}</Text>
          ) : null}
        </Stack>
        {seat.hasCallTime ? (
          <FeatureGate access={callTime}>
            {seat.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={seat.callTimeLeft} isPaused={seat.isAway} size="figure" />}
          </FeatureGate>
        ) : null}
        <SeatActions seat={seat} />
      </Stack>
    </Box>
  );
}
