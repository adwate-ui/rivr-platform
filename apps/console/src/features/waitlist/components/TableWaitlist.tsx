import {
  useApproveWaitlistRequest, useFloorWaitlistActions, type FloorTable, type InterestList, type WaitlistBoardEntry, type WaitlistFailure, type WaitlistRequest,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, ErrorMessage, Heading, Inline, JoinRequestRow, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { AddPlaceForm } from './AddPlaceForm.tsx';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';
import { InterestNotice } from './InterestNotice.tsx';
import { PlaceRow } from './PlaceRow.tsx';
import { tableMeta } from './placeMeta.ts';

export interface TableWaitlistProps {
  venueId: string;
  /** The table whose list this is (decision 0467): a place is seated only at it. */
  table: FloorTable;
  entries: readonly WaitlistBoardEntry[];
  /** Joins from the app waiting for the floor (#633). */
  requests: readonly WaitlistRequest[];
  /** A closed table's list is its interest in reopening it (#113): with Open table, for staff who open tables. */
  interest: InterestList | undefined;
  canOpen: boolean;
  now: Date;
  ticked: ReadonlySet<string>;
  onToggle: (entryId: string) => void;
  onSeat: (entry: WaitlistBoardEntry) => void;
  /** Opens the check in person for a place whose member's identity check waits for the desk (decision 0503). */
  onCheckId: (entry: WaitlistBoardEntry) => void;
}

/** The table's joins from the app, oldest first (#633): Approve puts the member on the list, Decline takes the request off. */
function JoinRequests({ venueId, table, requests }: { venueId: string; table: FloorTable; requests: readonly WaitlistRequest[] }) {
  const approve = useApproveWaitlistRequest();
  const { remove } = useFloorWaitlistActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const settle = async (step: Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>, said: string) => {
    const outcome = await step;
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) toast(said);
  };
  return (
    <>
      {requests.map((request) => {
        const name = request.fullName;
        return (
          <JoinRequestRow key={request.entryId} name={name} note={t('console.waitlist.card.asksToJoin')}
            approve={{ label: t('console.waitlist.approveShort'), name: t('console.waitlist.approve', { name }), isLoading: approve.isPending,
              onClick: () => void settle(approve.mutateAsync(request.entryId), t('console.waitlist.toast.approved', { name, table: table.name })) }}
            decline={{ label: t('console.waitlist.card.declineShort'), name: t('console.waitlist.card.decline', { name }), isLoading: remove.isPending,
              onClick: () => void settle(remove.mutateAsync(request.entryId), t('console.waitlist.toast.declined', { name })) }} />
        );
      })}
      {failure === null ? null : <Box paddingX={4}><ErrorMessage>{t(ENTRY_FAILURE_COPY[failure])}</ErrorMessage></Box>}
    </>
  );
}

/**
 * One table's waitlist as a card (console v3): its name, stake and open seats; the joins asking from the app; the places in
 * order, each with its tick, Seat and ⋯ menu; and a field to add a member by mobile or membership number.
 */
export function TableWaitlist({ venueId, table, entries, requests, interest, canOpen, now, ticked, onToggle, onSeat, onCheckId }: TableWaitlistProps) {
  return (
    <Box as="section" surface="raised" radius="lg">
      <Box paddingX={4} paddingY={4}>
        <Inline gap={2} justify="between" align="baseline" wrap>
          <Heading level={2} variant="card">{table.name}</Heading>
          <Text as="span" variant="secondary" tone="muted">{tableMeta(table)}</Text>
        </Inline>
      </Box>
      <JoinRequests venueId={venueId} table={table} requests={requests} />
      {interest === undefined ? null : (
        <Box paddingX={4} paddingY={2}><InterestNotice venueId={venueId} interest={interest} table={table} canOpen={canOpen} /></Box>
      )}
      {entries.length === 0 ? (
        <Box paddingX={4} paddingY={2}><Text variant="secondary" tone="muted">{t('console.waitlist.empty')}</Text></Box>
      ) : (
        <Stack gap={0}>
          {entries.map((entry) => (
            <PlaceRow key={entry.entryId} venueId={venueId} entry={entry} table={table} now={now} isTicked={ticked.has(entry.entryId)}
              onToggle={() => onToggle(entry.entryId)} onSeat={() => onSeat(entry)} onCheckId={() => onCheckId(entry)} />
          ))}
        </Stack>
      )}
      <Box paddingX={4} paddingY={4}><AddPlaceForm venueId={venueId} table={table} /></Box>
    </Box>
  );
}
