import { formatDate, t } from '@rivr/i18n';
import { Text } from '@rivr/ui';

/** An ISO day as noon UTC, so it formats as the same day in India. */
function day(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** A batch's first and last days. */
export function BatchDates({ startsOn, endsOn }: { startsOn: string; endsOn: string }) {
  return <Text tone="muted">{t('player.academy.dates', { from: formatDate(day(startsOn)), to: formatDate(day(endsOn)) })}</Text>;
}
