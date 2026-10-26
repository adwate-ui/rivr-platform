import { zodResolver } from '@hookform/resolvers/zod';
import { tournamentRoomSchema } from '@rivr/contracts/tournaments';
import { useTournamentBalance, useTournamentFloorActions, useTournamentSeating, type BalancePrompt, type TournamentSeatRow, type VenueTournament } from '@rivr/db';
import { formatList, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { BountyBust } from './BustAction.tsx';
import { CageBuyForm } from './CageBuyForm.tsx';
import { PlayersTable } from './PlayersTable.tsx';

/** The balancing prompts, or how the room stands when it is balanced: "Balanced · 2 tables: 8, 7". */
function BalanceLine({ prompts, rows, tables }: { prompts: readonly BalancePrompt[]; rows: readonly TournamentSeatRow[]; tables: number }) {
  if (prompts.length > 0) {
    return <Stack gap={1}>{prompts.map((prompt, index) => <Text key={`${String(index)}-${String(prompt.from)}`}>{t('console.tournaments.balanceMove', { from: prompt.from, to: prompt.to })}</Text>)}</Stack>;
  }
  const counts = Array.from({ length: tables }, (_, index) => String(rows.filter((row) => row.status === 'seated' && row.table === index + 1).length));
  return <Text tone="muted">{t('console.tournaments.balanced', { count: tables, counts: formatList(counts) })}</Text>;
}

type RoomValues = z.input<typeof tournamentRoomSchema>;

/** The room's tables and seats at each, for staff who run tournaments. */
function RoomForm({ venueId, tournament }: { venueId: string; tournament: VenueTournament }) {
  const { room } = useTournamentFloorActions(venueId, tournament.id);
  const [failure, setFailure] = useState<string | null>(null);
  const [resolver] = useState(() => zodResolver(tournamentRoomSchema));
  const form = useForm<RoomValues, unknown, z.output<typeof tournamentRoomSchema>>({
    resolver, defaultValues: { tables: String(tournament.tables), seatsPerTable: String(tournament.seatsPerTable) },
  });
  const fields = { tables: form.register('tables'), seats: form.register('seatsPerTable') };
  const isWrong = Object.keys(form.formState.errors).length > 0;
  const save = form.handleSubmit(async (values) => {
    const done = await room.mutateAsync(values);
    setFailure(done.ok ? null : t(done.error === 'invalid' ? 'console.tournaments.invalidRoom' : `console.tournaments.failures.${done.error}`));
  });
  return (
    <Stack gap={3}>
      <Heading level={3} variant="subsection">{t('console.tournaments.room')}</Heading>
      <Inline gap={4} align="end" wrap>
        <Input {...fields.tables} label={t('console.tournaments.tables')} inputMode="numeric" autoComplete="off" />
        <Input {...fields.seats} label={t('console.tournaments.seatsPerTable')} inputMode="numeric" autoComplete="off" />
        <Button variant="text" isLoading={room.isPending} onClick={() => void save()}>{t('console.tournaments.saveRoom')}</Button>
      </Inline>
      {isWrong ? <ErrorMessage>{t('console.tournaments.invalidRoom')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

interface FloorPanelProps {
  venueId: string;
  tournament: VenueTournament;
  canRun: boolean;
  canTakeCash: boolean;
}

/** The players and the balancing prompts, or the list's loading and error states. */
function Players({ venueId, tournament, canRun }: Omit<FloorPanelProps, 'canTakeCash'>) {
  const seating = useTournamentSeating(tournament.id);
  const balance = useTournamentBalance(tournament.id);
  const { floor } = useTournamentFloorActions(venueId, tournament.id);
  const [failure, setFailure] = useState<string | null>(null);
  const [busting, setBusting] = useState<TournamentSeatRow | null>(null);
  const label = t('console.tournaments.floor');
  if (seating.isPending) return <DataTable label={label} columns={[]} rowKey={() => ''} status="loading" />;
  if (seating.data === undefined) return <DataTable label={label} columns={[]} rowKey={() => ''} status="error" onRetry={() => void seating.refetch()} />;
  const onChange: typeof floor.mutate = (order) => void floor.mutateAsync(order)
    .then((done) => setFailure(done.ok ? null : t(`console.tournaments.payouts.failures.${done.error}`)));
  return (
    <Stack gap={4}>
      <Heading level={3} variant="subsection">{t('console.tournaments.tableBalance')}</Heading>
      {balance.data === undefined ? null : <BalanceLine prompts={balance.data} rows={seating.data} tables={tournament.tables} />}
      <PlayersTable rows={seating.data} prompts={balance.data ?? []} canRun={canRun} hasBounty={tournament.bounty !== null} onAskBust={setBusting} onChange={onChange} />
      {busting === null ? null : (
        <BountyBust key={busting.entryId} row={busting} rows={seating.data} onCancel={() => setBusting(null)}
          onBust={(eliminatorId) => { setBusting(null); onChange({ change: 'bust', entryId: busting.entryId, eliminatorId }); }} />
      )}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/**
 * The floor (#118, #120; decision 0204): the balancing prompts, every player with bust-outs and moves for
 * staff who run tournaments and refunds for alternates, the room, and buys taken in cash for a cashier.
 */
export function FloorPanel({ venueId, tournament, canRun, canTakeCash }: FloorPanelProps) {
  return (
    <Stack gap={6}>
      <Heading level={2} variant="section">{t('console.tournaments.floor')}</Heading>
      <Players venueId={venueId} tournament={tournament} canRun={canRun} />
      {canRun ? <RoomForm venueId={venueId} tournament={tournament} /> : null}
      {canTakeCash ? <CageBuyForm venueId={venueId} tournament={tournament} /> : null}
    </Stack>
  );
}
