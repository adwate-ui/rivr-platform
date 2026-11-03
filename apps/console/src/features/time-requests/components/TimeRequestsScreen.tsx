import { useDecideCallTime, useFloorSeats, useFloorTables, useStaffVenue, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

type Asking = SeatedPlayer & { timeRequest: { id: string; minutes: number } };
const isAsking = (seat: SeatedPlayer): seat is Asking => seat.timeRequest !== null;

interface RequestRowProps {
  request: Asking;
  tableName: string;
  busy: boolean | null;
  onDecide: (isApproved: boolean) => void;
}

/** One request: where and who, how much was asked and the call time left (or met), then Approve or Decline. */
function RequestRow({ request, tableName, busy, onDecide }: RequestRowProps) {
  const name = request.fullName;
  const left = request.callTimeLeft ?? 0;
  return (
    <Inline gap={4} justify="between" align="center" wrap>
      <Inline gap={3} align="center" wrap>
        <Text>{t('console.timeRequests.line', { table: tableName, seat: request.seat, name })}</Text>
        <Text variant="small" weight="semibold">{t('console.liveFloor.timeAsked', { time: formatDuration(request.timeRequest.minutes * 60) })}</Text>
        <Text variant="small" tone="muted">{left > 0 ? t('console.timeRequests.left', { time: formatDuration(left) }) : t('console.timeRequests.met')}</Text>
      </Inline>
      <Inline gap={2}>
        <Button variant="secondary" aria-label={t('console.liveFloor.approveTimeName', { name })} isLoading={busy === true}
          isDisabled={busy === false} onClick={() => onDecide(true)}>{t('console.liveFloor.approveTime')}</Button>
        <Button variant="text" aria-label={t('console.liveFloor.declineTimeName', { name })} isLoading={busy === false}
          isDisabled={busy === true} onClick={() => onDecide(false)}>{t('console.liveFloor.declineTime')}</Button>
      </Inline>
    </Inline>
  );
}

/** A refusal in words: the venue frozen, not in the role, or the request changed meanwhile. */
const failureText = (failure: SeatFailure) => t(`console.timeRequests.failures.${failure === 'paused' || failure === 'not_allowed' ? failure : 'changed'}`);

/**
 * Time requests (decision 0305): more call time members asked for from the app, table by table, each approved (the call
 * time grows, met or not) or declined from its line. For the floor (waitlist.manage); the rail counts them in red.
 */
export function TimeRequestsScreen() {
  const staff = useStaffVenue();
  const title = t('console.timeRequests.title');
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) return <Screen title={title} status="error" errorText={t('console.timeRequests.notAllowed')} />;
  return <TimeRequestsList venueId={staff.venue.venueId} title={title} />;
}

/** The requests waiting, read with the floor's seats and tables. */
function TimeRequestsList({ venueId, title }: { venueId: string; title: string }) {
  const seats = useFloorSeats(venueId);
  const tables = useFloorTables();
  const decide = useDecideCallTime(venueId);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  if (seats.data === undefined || tables.data === undefined) {
    const isError = seats.isError || tables.isError;
    return isError ? <Screen title={title} status="error" onRetry={() => void Promise.all([seats.refetch(), tables.refetch()])} /> : <Screen title={title} status="loading" />;
  }
  const asking = seats.data.filter(isAsking);
  const tableName = (tableId: string) => tables.data.find((table) => table.id === tableId)?.name ?? '';
  const busyFor = (requestId: string) => (decide.isPending && decide.variables.requestId === requestId ? decide.variables.isApproved : null);
  return (
    <Screen title={title}>
      <Stack gap={3}>
        {asking.length === 0 ? <Text tone="muted">{t('console.timeRequests.noneWaiting')}</Text> : (
          <Stack gap={2} divided>
            {asking.map((request) => (
              <RequestRow key={request.timeRequest.id} request={request} tableName={tableName(request.tableId)} busy={busyFor(request.timeRequest.id)}
                onDecide={(isApproved) => void decide.mutateAsync({ requestId: request.timeRequest.id, isApproved })
                  .then((outcome) => setFailure(outcome.ok ? null : outcome.error))} />
            ))}
          </Stack>
        )}
        {failure === null ? null : <ErrorMessage>{failureText(failure)}</ErrorMessage>}
      </Stack>
    </Screen>
  );
}
