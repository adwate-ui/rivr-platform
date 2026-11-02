import { useFeature, type MySeat } from '@rivr/db';
import { isAddTimeChoice } from '@rivr/domain/callTime';
import { t } from '@rivr/i18n';
import { Box, Button, DetailRow, FeatureGate, Grid, LockedNotice, RoundAction, Stack, useToast } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import type { SeatSheet } from './SeatSheets.tsx';

/** When the floor approves more call time, a toast says how much was added (the request goes, the minutes grow). */
function useTimeAdded(seat: MySeat) {
  const toast = useToast();
  const last = useRef({ asked: seat.timeRequestMinutes, minutes: seat.callTimeMinutes });
  useEffect(() => {
    const { asked, minutes } = last.current;
    last.current = { asked: seat.timeRequestMinutes, minutes: seat.callTimeMinutes };
    const isAdded = asked !== null && seat.timeRequestMinutes === null && (seat.callTimeMinutes ?? 0) > (minutes ?? 0);
    if (isAdded && isAddTimeChoice(asked)) toast(t('player.live.seat.timeAdded', { choice: t(`player.live.seat.times.m${asked}`) }));
  }, [seat.timeRequestMinutes, seat.callTimeMinutes, toast]);
}

/**
 * The seat's three round actions (brief 3.4 E): Top up (table.top_up), Add time (with call time, call_time.view) and Leave
 * seat (table.leave), each dimmed while its request waits on the floor; a tier's locked top-up says which tiers have it.
 */
export function SeatActions({ seat, onOpen }: { seat: MySeat; onOpen: (sheet: SeatSheet) => void }) {
  const topUp = useFeature('table.top_up');
  const callTime = useFeature('call_time.view');
  const leaving = useFeature('table.leave');
  useTimeAdded(seat);
  return (
    <Box paddingX={6} paddingY={5}>
      <Stack gap={3}>
        <Grid columns={3} gap={2}>
          {topUp.state === 'enabled' ? <RoundAction icon="topUp" label={t('player.live.seat.topUp')} isPending={seat.topUp !== null} onPress={() => onOpen('topUp')} /> : null}
          {/* A call time already met takes no more (decision 0324). */}
          {seat.hasCallTime && callTime.state === 'enabled' && (seat.callTimeLeft ?? 0) > 0 ? (
            <RoundAction icon="addTime" label={t('player.live.seat.addTime')} isPending={seat.timeRequestMinutes !== null} onPress={() => onOpen('addTime')} />
          ) : null}
          <FeatureGate access={leaving}>
            <RoundAction icon="leave" label={t('player.live.seat.leave')} isPending={seat.isLeaving} onPress={() => onOpen('leave')} />
          </FeatureGate>
        </Grid>
        {topUp.state === 'locked' ? <LockedNotice tiers={topUp.tiers} /> : null}
      </Stack>
    </Box>
  );
}

/** Food and drink to the seat (#123, feature fnb.table_side): the Order screen. */
export function OrderToSeat() {
  const fnb = useFeature('fnb.table_side');
  const navigate = useNavigate();
  return (
    <FeatureGate access={fnb}>
      <Box paddingX={5}>
        <Button variant="primary" size="tall" icon="food" fullWidth onClick={() => void navigate({ to: '/fnb' })}>{t('player.live.seat.order')}</Button>
      </Box>
    </FeatureGate>
  );
}

/** The seat's open requests, hairline-ruled: the top-up, more time asked for, and the Leaving list. */
export function SeatStatus({ seat }: { seat: MySeat }) {
  const asked = seat.timeRequestMinutes;
  return (
    <Box paddingX={5} paddingY={4}>
      {seat.topUp === null ? null : (
        <DetailRow size="small" hasDot label={t('player.live.seat.statusTopUp')} valueTone="accent"
          value={t(seat.topUp === 'requested' ? 'player.live.seat.requested' : 'player.live.seat.inProgress')} />
      )}
      {asked !== null && isAddTimeChoice(asked) ? (
        <DetailRow size="small" hasDot label={t(`player.live.seat.statusTimes.m${asked}`)} valueTone="accent" value={t('player.live.seat.requested')} />
      ) : null}
      {seat.isLeaving ? <DetailRow size="small" hasDot label={t('player.live.seat.statusLeaving')} valueTone="muted" value={t('player.live.seat.onTheList')} /> : null}
    </Box>
  );
}
