import { useAddCallTime, useAddTimeChoices, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, Inline, Text } from '@rivr/ui';
import { useRef } from 'react';

interface AddTimeProps {
  venueId: string;
  player: SeatedPlayer;
  report: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
}

/**
 * The floor's managers (call_time.override) add a length the club offers to a seated player's call time, without a request,
 * met or not (decision 0305): `Add time  +30 min  +1 h  +2 h`. Minutes only: no amount on any console (decision 0284).
 * Each length keeps its request id until it goes through, so tapping again after a lost answer adds it once.
 */
export function AddTime({ venueId, player, report }: AddTimeProps) {
  const choices = useAddTimeChoices(venueId);
  const add = useAddCallTime(venueId);
  const requestIds = useRef(new Map<number, string>());
  if (choices.data === undefined || choices.data.length === 0) return null;
  const send = (minutes: number) => {
    const requestId = requestIds.current.get(minutes) ?? crypto.randomUUID();
    requestIds.current.set(minutes, requestId);
    void add.mutateAsync({ sessionId: player.sessionId, minutes, requestId }).then((outcome) => {
      if (outcome.ok) requestIds.current.delete(minutes);
      report(outcome);
    });
  };
  return (
    <Inline gap={2} align="center" wrap>
      <Text variant="small" weight="semibold">{t('console.liveFloor.addTime')}</Text>
      {choices.data.map((minutes) => {
        const time = formatDuration(minutes * 60);
        return (
          <Button key={minutes} variant="text" aria-label={t('console.liveFloor.addTimeName', { time, name: player.fullName })}
            isLoading={add.isPending && add.variables.sessionId === player.sessionId && add.variables.minutes === minutes}
            onClick={() => send(minutes)}>
            {t('console.liveFloor.addTimeChoice', { time })}
          </Button>
        );
      })}
    </Inline>
  );
}
