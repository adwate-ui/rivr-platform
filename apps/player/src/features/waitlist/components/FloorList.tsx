import { useFeature, useMySeat, useMyTonight, useRestrictions, useWaitlistActions, type FloorTable, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, FloorRow, LockedNotice, Stack, type FeatureAccess } from '@rivr/ui';
import { useState } from 'react';
import { KycJoinNotice } from './KycJoinNotice.tsx';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** A table's open seats, where the member may read them (#87). */
function seatsOf(table: FloorTable): string | null {
  if (table.openSeats === null) return null;
  if (table.openSeats === 0) return t('player.tonight.full');
  return table.openSeats === 1 ? t('player.tonight.oneSeatOpen') : t('player.tonight.seatsOpen', { count: table.openSeats });
}

/** How many wait for a table's game, or the member's own place on its list, or their join waiting for the floor (#633). */
function waitOf(table: FloorTable, place: WaitlistPlace | undefined): string {
  if (place?.place === null) return t('player.tonight.requested', { count: table.waiting });
  if (place) return t('player.tonight.onTheList', { count: table.waiting, place: place.place });
  return table.waiting === 0 ? t('player.tonight.noWait') : t('player.tonight.waiting', { count: table.waiting });
}

/**
 * The line under a table: closed, or its open seats and its wait. A closed game's list is its interest
 * list (#113, decision 0184): joining it registers interest, and the floor opens a table once enough wait.
 */
function detailOf(table: FloorTable, place: WaitlistPlace | undefined, isRunning: boolean): string {
  if (!table.isOpen) {
    // A game not running: its waitlist is its interest list, so the line says how many are interested.
    if (isRunning || (table.waiting === 0 && !place)) return t('player.tonight.closed');
    return [t('player.tonight.closed'), waitOf(table, place)].join(' · ');
  }
  const callTime = table.callTimeMinutes > 0 ? t('player.tonight.callTime', { time: formatDuration(table.callTimeMinutes * 60) }) : null;
  return [seatsOf(table), callTime, waitOf(table, place)].filter((part) => part !== null).join(' · ');
}

/** A request id for each game, kept until joining it goes through, so a retried tap joins once. */
function useRequestIds() {
  const [ids, setIds] = useState<ReadonlyMap<string, string>>(new Map());
  const idFor = (tableTypeId: string) => ids.get(tableTypeId) ?? crypto.randomUUID();
  const keep = (tableTypeId: string, id: string) => setIds((current) => new Map(current).set(tableTypeId, id));
  const forget = (tableTypeId: string) => setIds((current) => new Map([...current].filter(([key]) => key !== tableTypeId)));
  return { idFor, keep, forget };
}

interface JoinButtonProps {
  table: FloorTable;
  access: FeatureAccess;
  isPending: boolean;
  /** This table's Join is the one pending: only it says so (F3-17). */
  isJoining: boolean;
  onJoin: () => void;
}

/** A table's Join, named by the table for a screen reader (F3-17), behind the tier's gate; a closed table's says Ask to open (P-08). */
function JoinButton({ table, access, isPending, isJoining, onJoin }: JoinButtonProps) {
  return (
    <FeatureGate access={access}>
      <Button variant="secondary" isLoading={isPending && isJoining} isDisabled={isPending && !isJoining}
        aria-label={t('player.tonight.joinName', { table: table.name })} onClick={onJoin}>
        {t('player.tonight.join')}
      </Button>
    </FeatureGate>
  );
}

/**
 * Tonight's tables in floor order, each with its stakes, open seats, wait and call time (#633), and Join while the member may join
 * (waitlist.join), is not seated and waits for no game: a join is a request the floor approves, one game at a time (#633); a closed table's Join registers interest in its game. Where the member's tier lacks Join, one locked notice says
 * which tiers have it; until their identity check is done, Join waits for it (#87).
 */
/** Whether the member may ask to join a game now: on no list, not seated and not on a break. */
function useMayJoin(places: readonly WaitlistPlace[]): boolean {
  const isSeated = (useMySeat().data ?? null) !== null;
  const isOnBreak = (useRestrictions().data?.breakUntil ?? null) !== null;
  return places.length === 0 && !isSeated && !isOnBreak;
}

export function FloorList({ tables, places }: { tables: readonly FloorTable[]; places: readonly WaitlistPlace[] }) {
  const joinAccess = useFeature('waitlist.join');
  // Until it is known, Join shows: the database refuses it without a finished check anyway.
  const isKycComplete = useMyTonight().data?.isKycComplete ?? true;
  const { join } = useWaitlistActions();
  // One game at a time (#633): seated, or waiting already, the member joins nothing.
  // No Join while on a list or seated, nor on a break, which the club would refuse (decision 0300).
  const mayJoin = useMayJoin(places);
  const requests = useRequestIds();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  // The table whose Join is pending, so only its button says so (F3-17).
  const [joiningAt, setJoiningAt] = useState<string | null>(null);
  const joinList = async (tableId: string, tableTypeId: string) => {
    setJoiningAt(tableId);
    const requestId = requests.idFor(tableTypeId);
    requests.keep(tableTypeId, requestId);
    const joined = await join.mutateAsync({ tableTypeId, requestId });
    setFailure(joined.ok ? null : joined.error);
    if (joined.ok) requests.forget(tableTypeId);
  };
  // The notice shows once above the list; each row's Join is simply absent while locked.
  const rowAccess: FeatureAccess = joinAccess.state === 'locked' || !isKycComplete ? { state: 'hidden' } : joinAccess;
  return (
    <Stack gap={4}>
      {joinAccess.state === 'locked' ? <LockedNotice tiers={joinAccess.tiers} /> : null}
      {joinAccess.state === 'enabled' && !isKycComplete ? <KycJoinNotice /> : null}
      {failure === null ? null : <ErrorMessage>{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
      <Stack gap={4} divided>
        {tables.map((table) => {
          const place = places.find((candidate) => candidate.tableTypeId === table.tableTypeId);
          const isRunning = tables.some((other) => other.tableTypeId === table.tableTypeId && other.isOpen);
          // Join only at an open table (decision 0300).
          const action = mayJoin && table.isOpen ? (
            <JoinButton table={table} access={rowAccess} isPending={join.isPending} isJoining={joiningAt === table.id}
              onJoin={() => void joinList(table.id, table.tableTypeId)} />
          ) : undefined;
          return (
            <FloorRow key={table.id} name={table.name} smallBlind={table.smallBlind} bigBlind={table.bigBlind}
              detail={detailOf(table, place, isRunning)} action={action} isMuted={!table.isOpen} />
          );
        })}
      </Stack>
    </Stack>
  );
}
