import { useMemberEarlyDepartures, type EarlyDeparture } from '@rivr/db';
import { formatDate, formatDuration, t } from '@rivr/i18n';
import { Heading, Stack, Text } from '@rivr/ui';

function line(departure: EarlyDeparture): string {
  return t('console.members.earlyDeparture', {
    date: formatDate(new Date(departure.at)), time: formatDuration(departure.shortfallSeconds), reason: departure.reason, name: departure.staffName,
  });
}

function Body({ list }: { list: ReturnType<typeof useMemberEarlyDepartures> }) {
  if (list.isError) return <Text tone="muted">{t('common.loadFailed')}</Text>;
  if (list.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  if (list.data.length === 0) return <Text tone="muted">{t('console.members.noEarlyDepartures')}</Text>;
  return <Stack gap={2} divided>{list.data.map((departure) => <Text key={departure.earlyDepartureId}>{line(departure)}</Text>)}</Stack>;
}

/** A member's early departures (#79, features "Call time"), newest first: when, the call time owed, why, and the admin who let them go. */
export function EarlyDepartures({ venueId, memberId }: { venueId: string; memberId: string }) {
  const list = useMemberEarlyDepartures(venueId, memberId);
  return (
    <Stack gap={2}>
      <Heading level={3}>{t('console.members.earlyDeparturesTitle')}</Heading>
      <Body list={list} />
    </Stack>
  );
}
