import { useFeature, useMySeat, useMySeatActions, type MySeat, type MySeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Box, Button, CallTimeTimer, ErrorMessage, FeatureGate, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

/** The top-up (#634): the way to ask for one, or where it stands until the floor resets it. */
function TopUpLine({ topUp, isPending, onRequest }: { topUp: MySeat['topUp']; isPending: boolean; onRequest: () => void }) {
  if (topUp === 'requested') return <Text variant="small" weight="medium">{t('player.tonight.topUpRequested')}</Text>;
  if (topUp === 'in_progress') return <Text variant="small" weight="medium">{t('player.tonight.topUpInProgress')}</Text>;
  return <Button variant="secondary" isLoading={isPending} onClick={onRequest}>{t('player.tonight.requestTopUp')}</Button>;
}

/**
 * What the member does from the seat (#634): an hour more call time while it runs (with call_time.view), a top-up (with
 * table.top_up), and leaving. With call time still owed, leaving puts them on the floor's Leaving list.
 */
function SeatActions({ seat }: { seat: MySeat }) {
  const callTime = useFeature('call_time.view');
  const topUp = useFeature('table.top_up');
  const leaving = useFeature('table.leave');
  const { extend, leave, requestTopUp } = useMySeatActions();
  const [failure, setFailure] = useState<MySeatFailure | null>(null);
  const report = (outcome: { ok: true } | { ok: false; error: MySeatFailure }) => setFailure(outcome.ok ? null : outcome.error);
  return (
    <Stack gap={2}>
      {(seat.callTimeLeft ?? 0) > 0 && callTime.state === 'enabled' ? (
        <Button variant="secondary" isLoading={extend.isPending} onClick={() => void extend.mutateAsync().then(report)}>
          {t('player.tonight.extendCallTime')}
        </Button>
      ) : null}
      {topUp.state === 'hidden' ? null : (
        <FeatureGate access={topUp}>
          <TopUpLine topUp={seat.topUp} isPending={requestTopUp.isPending} onRequest={() => void requestTopUp.mutateAsync().then(report)} />
        </FeatureGate>
      )}
      {seat.isLeaving ? <Text variant="small" tone="muted">{t('player.tonight.onLeavingList')}</Text> : (
        <FeatureGate access={leaving}>
          <Button variant="secondary" isLoading={leave.isPending} onClick={() => void leave.mutateAsync().then(report)}>{t('player.tonight.leaveSeat')}</Button>
        </FeatureGate>
      )}
      {failure === null ? null : <ErrorMessage>{t(`player.tonight.seatFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * While the member is seated (#78): their table and seat, always theirs to see as their waitlist
 * places are (decision 0057); how long they have played (#634); the call time left with call_time.view, or the locked
 * notice; what they do from the seat (#634); and, with table-side ordering (#123), the way to order food and drink to
 * the seat. Nothing otherwise.
 */
export function SeatNotice() {
  const seat = useMySeat().data ?? null;
  const callTime = useFeature('call_time.view');
  const fnb = useFeature('fnb.table_side');
  const navigate = useNavigate();
  if (seat === null) return null;
  return (
    <Box surface="raised" padding={4} radius="md">
      <Stack gap={2}>
        <Text>{t('player.tonight.seated', { table: seat.tableName, seat: seat.seat })}</Text>
        <Text variant="small" tone="muted">{t('player.tonight.playedFor', { time: formatDuration(seat.playedSeconds) })}</Text>
        {seat.hasCallTime ? (
          <FeatureGate access={callTime}>
            {seat.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={seat.callTimeLeft} isPaused={seat.isAway} />}
          </FeatureGate>
        ) : null}
        <SeatActions seat={seat} />
        {fnb.state === 'enabled' ? (
          <FeatureGate access={fnb}>
            <Button variant="secondary" onClick={() => void navigate({ to: '/fnb' })}>{t('player.fnb.order')}</Button>
          </FeatureGate>
        ) : null}
      </Stack>
    </Box>
  );
}
