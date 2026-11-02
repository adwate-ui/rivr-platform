import { useDecideCallTime, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, Inline, Text } from '@rivr/ui';

interface TimeRequestProps {
  venueId: string;
  player: SeatedPlayer & { timeRequest: { id: string; minutes: number } };
  report: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
}

/**
 * More call time a member asked for from the app (decision 0320), on their seat's row: how much, then Approve, which adds
 * it to their call time, or Decline. Minutes only: no amount on any console (decision 0284).
 */
export function TimeRequest({ venueId, player, report }: TimeRequestProps) {
  const decide = useDecideCallTime(venueId);
  const { id, minutes } = player.timeRequest;
  const isBusy = (isApproved: boolean) => decide.isPending && decide.variables.requestId === id && decide.variables.isApproved === isApproved;
  return (
    <Inline gap={2} align="center" wrap>
      <Text variant="small" weight="semibold">{t('console.liveFloor.timeAsked', { time: formatDuration(minutes * 60) })}</Text>
      <Button variant="secondary" aria-label={t('console.liveFloor.approveTimeName', { name: player.fullName })} isLoading={isBusy(true)}
        onClick={() => void decide.mutateAsync({ requestId: id, isApproved: true }).then(report)}>{t('console.liveFloor.approveTime')}</Button>
      <Button variant="text" aria-label={t('console.liveFloor.declineTimeName', { name: player.fullName })} isLoading={isBusy(false)}
        onClick={() => void decide.mutateAsync({ requestId: id, isApproved: false }).then(report)}>{t('console.liveFloor.declineTime')}</Button>
    </Inline>
  );
}
