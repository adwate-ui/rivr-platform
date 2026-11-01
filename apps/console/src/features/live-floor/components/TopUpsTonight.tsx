import { useTopUpsTonight, type TopUpTonight } from '@rivr/db';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Heading, Inline, LoadState, Stack, Text } from '@rivr/ui';

/** Where one request stands, and once fulfilled how long it took. */
function statusOf(request: TopUpTonight): string {
  if (request.status === 'fulfilled') return t('console.liveFloor.topUpStatus.fulfilled', { time: formatDuration(request.fulfilledSeconds ?? 0) });
  return t(`console.liveFloor.topUpStatus.${request.status}`);
}

/** Tonight's top-up requests by table (#639), for the floor and the cashier: who, where, when, and where each stands. */
export function TopUpsTonight({ venueId }: { venueId: string }) {
  const requests = useTopUpsTonight(venueId);
  if (requests.data === undefined) return <LoadState isError={requests.isError} onRetry={() => void requests.refetch()} />;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.liveFloor.topUpsTitle')}</Heading>
      {requests.data.length === 0 ? <Text tone="muted">{t('console.liveFloor.noTopUps')}</Text> : (
        <Stack gap={2} divided>
          {requests.data.map((request) => (
            <Inline key={request.requestId} gap={4} justify="between" align="center" wrap>
              <Text>{t('console.liveFloor.topUpLine', { table: request.tableName, seat: request.seat, name: request.fullName })}</Text>
              <Inline gap={3}>
                <Text variant="small" tone="muted">{formatTime(new Date(request.requestedAt))}</Text>
                <Text variant="small" weight="semibold">{statusOf(request)}</Text>
              </Inline>
            </Inline>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
