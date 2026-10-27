import { useFeature, useMySeat } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Button, CallTimeTimer, FeatureGate, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * While the member is seated (#78): their table and seat, always theirs to see as their waitlist
 * places are (decision 0057); the call time left with call_time.view, or the locked notice; and, with table-side
 * ordering (#123), the way to order food and drink to the seat. Nothing otherwise.
 */
export function SeatNotice() {
  const seat = useMySeat().data ?? null;
  const callTime = useFeature('call_time.view');
  const fnb = useFeature('fnb.table_side');
  const navigate = useNavigate();
  if (seat === null) return null;
  return (
    <Box surface="raised" padding={4} radius="md">
      <Stack gap={1}>
        <Text>{t('player.tonight.seated', { table: seat.tableName, seat: seat.seat })}</Text>
        {seat.hasCallTime ? (
          <FeatureGate access={callTime}>
            {seat.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={seat.callTimeLeft} isPaused={seat.isAway} />}
          </FeatureGate>
        ) : null}
        {fnb.state === 'enabled' ? (
          <FeatureGate access={fnb}>
            <Button variant="secondary" onClick={() => void navigate({ to: '/fnb' })}>{t('player.fnb.order')}</Button>
          </FeatureGate>
        ) : null}
      </Stack>
    </Box>
  );
}
