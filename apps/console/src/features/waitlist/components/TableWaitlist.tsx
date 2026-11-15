import { type FloorTable, type InterestList, useApproveWaitlistRequest, useFloorSeats, useFloorWaitlistActions, type WaitlistFailure, type WaitlistRequest } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, ErrorMessage, Heading, Inline, JoinRequestRow, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';
import { InterestNotice } from './InterestNotice.tsx';
import { tableMeta } from './placeMeta.ts';

export interface TableWaitlistProps {
  venueId: string;
  /** The table whose list this is (decision 0467). */
  table: FloorTable;
  /** How many wait on its list. */
  waiting: number;
  /** Joins from the app waiting for the floor (#633). */
  requests: readonly WaitlistRequest[];
  /** A closed table's list is its interest in reopening it (#113): with Open table, for staff who open tables. */
  interest: InterestList | undefined;
  canOpen: boolean;
  /** A join approved: its seat sheet follows when a seat is free for it (the owner, 8 Nov). */
  onApproved: (entryId: string) => void;
}

/** The table's joins from the app, oldest first (#633): Approve puts the member on the list, Decline takes the request off. */
function JoinRequests({ venueId, table, requests, onApproved }: {
  venueId: string; table: FloorTable; requests: readonly WaitlistRequest[]; onApproved: (entryId: string) => void;
}) {
  const approve = useApproveWaitlistRequest();
  const { remove } = useFloorWaitlistActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const settle = async (step: Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>, said: string) => {
    const outcome = await step;
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) toast(said);
    return outcome.ok;
  };
  const approveOne = async (request: WaitlistRequest) => {
    const name = request.fullName;
    if (await settle(approve.mutateAsync(request.entryId), t('console.waitlist.toast.approved', { name, table: table.name }))) onApproved(request.entryId);
  };
  return (
    <>
      {requests.map((request) => {
        const name = request.fullName;
        return (
          <JoinRequestRow key={request.entryId} name={name} note={t('console.waitlist.card.asksToJoin')}
            approve={{ label: t('console.waitlist.approveShort'), name: t('console.waitlist.approve', { name }), isLoading: approve.isPending,
              onClick: () => void approveOne(request) }}
            decline={{ label: t('console.waitlist.card.declineShort'), name: t('console.waitlist.card.decline', { name }), isLoading: remove.isPending,
              onClick: () => void settle(remove.mutateAsync(request.entryId), t('console.waitlist.toast.declined', { name })) }} />
        );
      })}
      {failure === null ? null : <Box paddingX={4}><ErrorMessage>{t(ENTRY_FAILURE_COPY[failure])}</ErrorMessage></Box>}
    </>
  );
}

/** A table with no seat free while members wait on its list (audit F-030). */
export const isFullWithWaiting = (table: FloorTable, waiting: number) => table.isOpen && table.openSeats === 0 && waiting > 0;

/** A full table's note: when a seat will come, by who is on their way out (audit F-030). */
function FullNote({ venueId, tableId }: { venueId: string; tableId: string }) {
  const leaving = (useFloorSeats(venueId).data ?? []).filter((seat) => seat.tableId === tableId && seat.leavingAt !== null).map((seat) => seat.fullName);
  return (
    <Box paddingX={4} paddingY={2}>
      <Text variant="secondary" tone="muted">{leaving.length === 0 ? t('console.waitlist.tableFull') : t('console.waitlist.tableFullLeaving', { names: leaving.join(', ') })}</Text>
    </Box>
  );
}

/**
 * What one table has of its own to say over the Waitlist's places, as a card (console v3; redesign RD-31): its name, stake
 * and open seats; that it is full, and who is on their way out; the joins asking from the app; a closed table's interest,
 * with Open table. A table with none of these has no card. Its places are rows of the one table below.
 */
export function TableWaitlist({ venueId, table, waiting, requests, interest, canOpen, onApproved }: TableWaitlistProps) {
  return (
    <Box as="section" surface="raised" radius="lg">
      <Box paddingX={4} paddingY={4}>
        <Inline gap={2} justify="between" align="baseline" wrap>
          <Heading level={2} variant="card">{table.name}</Heading>
          <Text as="span" variant="secondary" tone="muted">{tableMeta(table)}</Text>
        </Inline>
      </Box>
      {isFullWithWaiting(table, waiting) ? <FullNote venueId={venueId} tableId={table.id} /> : null}
      <JoinRequests venueId={venueId} table={table} requests={requests} onApproved={onApproved} />
      {interest === undefined ? null : (
        <Box paddingX={4} paddingY={2}><InterestNotice venueId={venueId} interest={interest} table={table} canOpen={canOpen} /></Box>
      )}
    </Box>
  );
}
