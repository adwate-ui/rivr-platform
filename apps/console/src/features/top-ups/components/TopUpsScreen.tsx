import type { Permission } from '@rivr/contracts';
import { isTopUpLate, secondsWaiting } from '@rivr/domain/topUps';
import { isTopUpWaiting, useSetTopUp, useStaffVenue, useTopUpsTonight, type SeatFailure, type TopUpTonight } from '@rivr/db';
import { formatDuration, formatMinutesSeconds, formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, MemberLink, Screen, Stack, Text, WaitTimer } from '@rivr/ui';
import { useEffect, useState } from 'react';
import { PastTopUps } from './PastTopUps.tsx';

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

/** Who took each step of a request and how long it took (redesign RD-32): accepted, then done; nothing for a step not taken. */
function stepsOf(request: TopUpTonight): string[] {
  const accepted = request.acceptedBy === null || request.acceptedSeconds === null ? []
    : [t('console.topUps.acceptedBy', { name: request.acceptedBy, time: formatMinutesSeconds(request.acceptedSeconds) })];
  const done = request.doneBy === null || request.doneSeconds === null ? []
    : [t('console.topUps.doneBy', { name: request.doneBy, time: formatMinutesSeconds(request.doneSeconds) })];
  return [...accepted, ...done];
}

/** Who and where, when they asked; for a waiting one, its wait against the minute; then who took each step and how long it took. */
function Who({ request, now }: { request: TopUpTonight; now: Date | null }) {
  return (
    <Stack gap={1}>
      <Inline gap={3} align="center" wrap>
        {/* Where, then who: the name opens their account (owner, 19 Nov). */}
        <Text>
          {request.memberId === null ? t('console.topUps.line', { table: request.tableName, seat: request.seat, name: request.fullName }) : (
            <>{t('console.topUps.lineWhere', { table: request.tableName, seat: request.seat })}<MemberLink memberId={request.memberId}>{request.fullName}</MemberLink></>
          )}
        </Text>
        <Text variant="small" tone="muted">{t('console.topUps.askedAt', { time: formatTime(new Date(request.requestedAt)) })}</Text>
        {now === null ? null : <WaitTimer seconds={secondsWaiting(new Date(request.requestedAt), now)} isLate={isTopUpLate(secondsWaiting(new Date(request.requestedAt), now))} />}
      </Inline>
      {stepsOf(request).map((step) => <Text key={step} variant="small" tone="muted">{step}</Text>)}
    </Stack>
  );
}

/** A waiting request: Start and Reset while asked, Done once in hand; set_top_up closes it as fulfilled or reset. */
function WaitingRow({ request, now, isBusy, onSet }: { request: TopUpTonight; now: Date; isBusy: boolean; onSet: (inProgress: boolean) => void }) {
  const name = request.fullName;
  return (
    <Inline gap={4} justify="between" align="center" wrap>
      <Who request={request} now={now} />
      <Inline gap={2}>
        {request.status === 'requested' ? (
          <>
            <Button variant="subtle" aria-label={t('console.topUps.startName', { name })} isLoading={isBusy} onClick={() => onSet(true)}>{t('console.topUps.start')}</Button>
            <Button variant="text" aria-label={t('console.topUps.resetName', { name })} isDisabled={isBusy} onClick={() => onSet(false)}>{t('console.topUps.reset')}</Button>
          </>
        ) : (
          <Button variant="subtle" aria-label={t('console.topUps.doneName', { name })} isLoading={isBusy} onClick={() => onSet(false)}>{t('console.topUps.done')}</Button>
        )}
      </Inline>
    </Inline>
  );
}

/** Who handles top-ups: the floor, by its own permission, and guest relations and admins by theirs (redesign RD-32). */
const handlesTopUps = (permissions: readonly Permission[]) => permissions.includes('waitlist.manage') || permissions.includes('top_ups.manage');

/**
 * Top-ups (decision 0299): the requests waiting, oldest first, each with its wait counting up and red once past the minute,
 * whoever handles them starting and finishing each from its line; then tonight's closed ones with how long each took, and
 * past days a page at a time. Each says who accepted it, who marked it done and how long each step took (redesign RD-32).
 * For the floor (waitlist.manage) and for guest relations (top_ups.manage), whose whole console this is.
 */
export function TopUpsScreen() {
  const staff = useStaffVenue();
  const venueId = staff.status === 'ready' ? staff.venue.venueId : '';
  const requests = useTopUpsTonight(venueId, staff.status === 'ready');
  const setTopUp = useSetTopUp(venueId);
  const now = useNow();
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const title = t('console.topUps.title');
  if (staff.status !== 'ready') return null;
  if (!handlesTopUps(staff.venue.permissions)) return <Screen title={title} status="error" errorText={t('console.topUps.notAllowed')} />;
  if (requests.data === undefined) {
    return requests.isError ? <Screen title={title} status="error" onRetry={() => void requests.refetch()} /> : <Screen title={title} status="loading" />;
  }
  const waiting = requests.data.filter(isTopUpWaiting).sort((one, two) => one.requestedAt.localeCompare(two.requestedAt));
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Stack gap={3}>
          <Heading level={2}>{t('console.topUps.waiting')}</Heading>
          {waiting.length === 0 ? <Text tone="muted">{t('console.topUps.noneWaiting')}</Text> : (
            <Stack gap={2} divided>
              {waiting.map((request) => (
                <WaitingRow key={request.requestId} request={request} now={now}
                  isBusy={setTopUp.isPending && setTopUp.variables.sessionId === request.sessionId}
                  onSet={(inProgress) => void setTopUp.mutateAsync({ sessionId: request.sessionId, inProgress })
                    .then((outcome) => setFailure(outcome.ok ? null : outcome.error))} />
              ))}
            </Stack>
          )}
          {failure === null ? null : <ErrorMessage>{t(`console.topUps.failures.${failure === 'paused' || failure === 'not_allowed' ? failure : 'changed'}`)}</ErrorMessage>}
        </Stack>
        <Earlier requests={requests.data.filter((request) => !isTopUpWaiting(request))} />
        <PastTopUps venueId={venueId} />
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

