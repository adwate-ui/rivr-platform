import { useOpenMarkers, type OpenMarker } from '@rivr/db';
import { formatDate, formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Stack, Text, LoadState } from '@rivr/ui';

/** How old a marker is and when it falls due: today, a day, or days; past due says so. */
function ageOf(marker: OpenMarker): string {
  const due = formatDate(new Date(marker.dueAt));
  if (marker.isPastDue) return t('console.markers.pastDue', { days: marker.ageDays, due });
  if (marker.ageDays === 0) return t('console.markers.ageToday', { due });
  return marker.ageDays === 1 ? t('console.markers.ageOne', { due }) : t('console.markers.age', { days: marker.ageDays, due });
}

/** Open markers by player and age, oldest first, as in the prototype (#74): how much is left, how old, when due or past due, and the limit. */
export function OpenMarkers({ venueId }: { venueId: string }) {
  const markers = useOpenMarkers(venueId);
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.markers.open')}</Heading>
      {markers.isPending ? <LoadState /> : null}
      {markers.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
          <Button onClick={() => void markers.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {markers.data?.length === 0 ? <Text tone="muted">{t('console.markers.noOpen')}</Text> : null}
      <Stack gap={2} divided>
        {(markers.data ?? []).map((marker) => (
          <Inline key={marker.markerId} gap={4} justify="between" align="center">
            <Stack gap={1}>
              <Text weight="medium">{marker.fullName}</Text>
              <Text variant="small" tone={marker.isPastDue ? 'default' : 'muted'}>{ageOf(marker)}</Text>
              <Text variant="small" tone="muted">{t('console.markers.ofLimit', { amount: formatMoney(marker.amount), limit: formatMoney(marker.limit) })}</Text>
            </Stack>
            <Money paise={marker.outstanding} />
          </Inline>
        ))}
      </Stack>
    </Stack>
  );
}
