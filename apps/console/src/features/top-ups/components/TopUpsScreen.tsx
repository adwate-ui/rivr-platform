import { secondsWaiting, TOP_UP_TARGET_SECONDS } from '@rivr/domain/topUps';
import { isTopUpWaiting, useSetTopUp, useStaffVenue, useTopUpsTonight, type TopUpTonight } from '@rivr/db';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, Heading, Inline, Screen, Stack, Text, WaitTimer } from '@rivr/ui';
import { useEffect, useState } from 'react';

/** The time now, once a second, so each wait counts up on screen. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);
  return now;
}

/** Where a closed request stands, and once fulfilled how long it took. */
function statusOf(request: TopUpTonight): string {
  if (request.status === 'fulfilled') return t('console.topUps.status.fulfilled', { time: formatDuration(request.fulfilledSeconds ?? 0) });
  return t(`console.topUps.status.${request.status}`);
}

/** Who and where, when they asked; for a waiting one, its wait against the minute. */
function Who({ request, now }: { request: TopUpTonight; now: Date | null }) {
  return (
    <Inline gap={3} align="center" wrap>
      <Text>{t('console.topUps.line', { table: request.tableName, seat: request.seat, name: request.fullName })}</Text>
      <Text variant="small" tone="muted">{t('console.topUps.askedAt', { time: formatTime(new Date(request.requestedAt)) })}</Text>
      {now === null ? null : <WaitTimer seconds={secondsWaiting(new Date(request.requestedAt), now)} lateAfter={TOP_UP_TARGET_SECONDS} />}
    </Inline>
  );
}

/** A waiting request: Start and Reset while asked, Done once in hand; set_top_up closes it as fulfilled or reset. */
function WaitingRow({ request, now, onSet }: { request: TopUpTonight; now: Date; onSet: (inProgress: boolean) => void }) {
  const name = request.fullName;
  return (
    <Inline gap={4} justify="between" align="center" wrap>
      <Who request={request} now={now} />
      <Inline gap={2}>
        {request.status === 'requested' ? (
          <>
            <Button variant="secondary" aria-label={t('console.topUps.startName', { name })} onClick={() => onSet(true)}>{t('console.topUps.start')}</Button>
            <Button variant="text" aria-label={t('console.topUps.resetName', { name })} onClick={() => onSet(false)}>{t('console.topUps.reset')}</Button>
          </>
        ) : (
          <Button variant="secondary" aria-label={t('console.topUps.doneName', { name })} onClick={() => onSet(false)}>{t('console.topUps.done')}</Button>
        )}
      </Inline>
    </Inline>
  );
}

/**
 * Top-ups (decision 0299): the requests waiting, oldest first, each with its wait counting up and red once past the minute,
 * the floor starting and finishing each from its line; then tonight's closed ones with how long each took. For the floor
 * (waitlist.manage); the rail counts the waiting ones in red.
 */
export function TopUpsScreen() {
  const staff = useStaffVenue();
  const venueId = staff.status === 'ready' ? staff.venue.venueId : '';
  const requests = useTopUpsTonight(venueId, staff.status === 'ready');
  const setTopUp = useSetTopUp(venueId);
  const now = useNow();
  const title = t('console.topUps.title');
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) return <Screen title={title} status="error" errorText={t('console.topUps.notAllowed')} />;
  if (requests.data === undefined) {
    return requests.isError ? <Screen title={title} status="error" onRetry={() => void requests.refetch()} /> : <Screen title={title} status="loading" />;
  }
  const waiting = requests.data.filter(isTopUpWaiting).sort((one, two) => one.requestedAt.localeCompare(two.requestedAt));
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Text tone="muted">{t('console.topUps.target')}</Text>
        <Stack gap={3}>
          <Heading level={2}>{t('console.topUps.waiting')}</Heading>
          {waiting.length === 0 ? <Text tone="muted">{t('console.topUps.noneWaiting')}</Text> : (
            <Stack gap={2} divided>
              {waiting.map((request) => (
                <WaitingRow key={request.requestId} request={request} now={now}
                  onSet={(inProgress) => void setTopUp.mutateAsync({ sessionId: request.sessionId, inProgress })} />
              ))}
            </Stack>
          )}
        </Stack>
        <Earlier requests={requests.data.filter((request) => !isTopUpWaiting(request))} />
      </Stack>
    </Screen>
  );
}

/** Tonight's closed requests, each with where it stands. */
function Earlier({ requests }: { requests: readonly TopUpTonight[] }) {
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.topUps.earlier')}</Heading>
      {requests.length === 0 ? <Text tone="muted">{t('console.topUps.noneEarlier')}</Text> : (
        <Stack gap={2} divided>
          {requests.map((request) => (
            <Inline key={request.requestId} gap={4} justify="between" align="center" wrap>
              <Who request={request} now={null} />
              <Text variant="small" weight="semibold">{statusOf(request)}</Text>
            </Inline>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

