import { useWaitlistRequests } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** How many ask to join a game from the app (#633, #638), with the way to the Waitlist, where the floor approves them. Nothing when none ask. */
export function JoinRequestsNotice({ venueId }: { venueId: string }) {
  const count = useWaitlistRequests(venueId).data?.length ?? 0;
  const navigate = useNavigate();
  if (count === 0) return null;
  return (
    <Inline gap={3} align="center" wrap>
      <Text weight="semibold">{count === 1 ? t('console.liveFloor.oneRequestWaiting') : t('console.liveFloor.requestsWaiting', { count })}</Text>
      <Button variant="secondary" onClick={() => void navigate({ to: '/waitlist' })}>{t('console.liveFloor.openWaitlist')}</Button>
    </Inline>
  );
}
