import { useFeature, useFnbOff, type MySeat, type WaitlistPlace } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Button, DetailRow, FeatureGate, Grid, LockedNotice, RoundAction, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import type { SeatSheet } from './SeatSheets.tsx';
import { lineOf, stakeOf } from './waitlistCopy.ts';

/**
 * Whether the seat offers its call time action (#1076, the owner, 18 Nov): Set call time once a length the club offers would
 * end after the call time the seat started with; Extend call time once one is set. A seat with no call time has neither.
 */
const callTimeAction = (seat: MySeat): 'set' | 'extend' | null => {
  if (!seat.hasCallTime || seat.callTimeChoicesOpen.length === 0) return null;
  return seat.callTimeSetAt === null ? 'set' : 'extend';
};

/**
 * The seat's three round actions (brief 3.4 E): Top up (table.top_up), dimmed while it waits on the floor; Set call time,
 * then Extend call time (call_time.view, #1059, #1076); and Leave seat (table.leave), never dimmed (the owner, 17 Nov: no
 * leave option is greyed out). A tier's locked top-up says which tiers have it.
 */
export function SeatActions({ seat, onOpen }: { seat: MySeat; onOpen: (sheet: SeatSheet) => void }) {
  const topUp = useFeature('table.top_up');
  const callTime = useFeature('call_time.view');
  const leaving = useFeature('table.leave');
  const action = callTime.state === 'enabled' ? callTimeAction(seat) : null;
  // A column for each action shown, so two sit evenly rather than in the left two thirds (F-203).
  const shown = [topUp.state === 'enabled', action !== null, leaving.state !== 'hidden'].filter(Boolean).length;
  return (
    <Box paddingX={5} paddingY={5}>
      <Stack gap={3}>
        <Grid columns={shown === 1 ? 1 : shown === 2 ? 2 : 3} gap={2}>
          {topUp.state === 'enabled' ? <RoundAction icon="topUp" label={t('player.live.seat.topUp')} isPending={seat.topUp !== null} onPress={() => onOpen('topUp')} /> : null}
          {action === null ? null : (
            <RoundAction icon="addTime" label={t(action === 'set' ? 'player.live.seat.setCallTime' : 'player.live.seat.extendCallTime')} onPress={() => onOpen('addTime')} />
          )}
          <FeatureGate access={leaving}>
            <RoundAction icon="leave" label={t('player.live.seat.leave')} onPress={() => onOpen('leave')} />
          </FeatureGate>
        </Grid>
        {topUp.state === 'locked' ? <LockedNotice tiers={topUp.tiers} /> : null}
      </Stack>
    </Box>
  );
}

/** Food and drink to the seat (#123, feature fnb.table_side): the Order screen; none while F&B is off (decision 0681). */
export function OrderToSeat() {
  const fnb = useFeature('fnb.table_side');
  const isFnbOff = useFnbOff();
  const navigate = useNavigate();
  if (isFnbOff) return null;
  return (
    <FeatureGate access={fnb}>
      <Box paddingX={5}>
        <Button variant="primary" size="tall" icon="food" fullWidth onClick={() => void navigate({ to: '/fnb' })}>{t('player.live.seat.order')}</Button>
      </Box>
    </FeatureGate>
  );
}

/**
 * The seat's open requests, hairline-ruled: the top-up, the Leaving list, and a place on another list to change tables,
 * with where the member stands on it (#781).
 */
export function SeatStatus({ seat, places }: { seat: MySeat; places: readonly WaitlistPlace[] }) {
  return (
    <Box paddingX={5} paddingY={4}>
      {seat.topUp === null ? null : (
        <DetailRow size="small" hasDot label={t('player.live.seat.statusTopUp')} valueTone="accent"
          value={t(seat.topUp === 'requested' ? 'player.live.seat.requested' : 'player.live.seat.inProgress')} />
      )}
      {seat.isLeaving ? <DetailRow size="small" hasDot label={t('player.live.seat.statusLeaving')} valueTone="muted" value={t('player.live.seat.onTheList')} /> : null}
      {places.map((place) => (
        <DetailRow key={place.entryId} size="small" hasDot valueTone="accent" value={lineOf(place)}
          label={place.tableName === null ? t('player.live.seat.statusWaitlist', { game: stakeOf(place) })
            : t('player.live.list.eyebrow', { table: place.tableName, game: stakeOf(place) })} />
      ))}
    </Box>
  );
}
