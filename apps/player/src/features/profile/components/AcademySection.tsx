import { useAcademyBookings } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * The way to the member's Academy seats, once they have one. Learn links to the Academy only with
 * Academy booking, but a member's seats show without it (decision 0033), so the way to them must too.
 */
export function AcademySection() {
  const navigate = useNavigate();
  const bookings = useAcademyBookings();
  // Loading, unreadable or no seats: nothing, and the rest of Profile is unaffected.
  if (bookings.data === undefined || bookings.data.length === 0) return null;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.academy.title')}</Heading>
      <Button variant="secondary" onClick={() => void navigate({ to: '/academy' })}>
        {t('player.profile.academyBookings')}
      </Button>
    </Stack>
  );
}
