import { useStaffVenue, useVenueTournaments, type VenueTournament } from '@rivr/db';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, Screen, Stack, Tabs, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { NewTournamentSheet } from './NewTournamentSheet.tsx';
import { TournamentSheet } from './TournamentSheet.tsx';

const TABS = ['upcoming', 'past'] as const;
type View = (typeof TABS)[number];

// The panel open: a new tournament's, or a tournament's own record by its id.
const NEW = 'new';

// The Past list opens on the one that started last.
const LATEST_FIRST = { key: 'starts', direction: 'descending' } as const;

const startOf = (tournament: VenueTournament) => new Date(tournament.startsAt);

/** How many were notified; before that, Not yet while it can still be sent, and nothing once it has started. */
function notifiedOf(tournament: VenueTournament) {
  if (tournament.notified !== null) return formatNumber(tournament.notified);
  return tournament.isPast ? t('console.tournaments.none') : <Text as="span" tone="muted">{t('console.tournaments.notYet')}</Text>;
}

/** The columns of both lists: the tournament, its start and game, how many asked, how many were notified, and its entries. */
function columns(): readonly DataTableColumn<VenueTournament>[] {
  return [
    { key: 'name', header: t('console.tournaments.columns.name'), cell: (tournament) => tournament.name, sortValue: (tournament) => tournament.name, priority: 'primary', filter: false },
    {
      key: 'starts', header: t('console.tournaments.columns.starts'), cell: (tournament) => formatDayTime(startOf(tournament)),
      sortValue: (tournament) => startOf(tournament).getTime(), exportValue: (tournament) => formatDayTime(startOf(tournament)), filter: false,
    },
    { key: 'game', header: t('console.tournaments.columns.game'), cell: (tournament) => tournament.game, sortValue: (tournament) => tournament.game, filter: 'choice' },
    {
      key: 'interested', header: t('console.tournaments.columns.interested'), cell: (tournament) => formatNumber(tournament.interested),
      sortValue: (tournament) => tournament.interested, align: 'end', filter: false,
    },
    {
      key: 'notified', header: t('console.tournaments.columns.notified'), cell: notifiedOf, sortValue: (tournament) => tournament.notified ?? -1,
      exportValue: (tournament) => tournament.notified ?? '', align: 'end', filter: false,
    },
    {
      key: 'entries', header: t('console.tournaments.columns.entries'),
      cell: (tournament) => (tournament.entries === null ? t('console.tournaments.none') : formatNumber(tournament.entries)),
      sortValue: (tournament) => tournament.entries ?? -1, exportValue: (tournament) => tournament.entries ?? '', align: 'end', filter: false,
    },
  ];
}

interface TournamentsProps {
  /** The list in the address: Upcoming, or Past with `?tab=past`; and how a tab opens. */
  tab: string | undefined;
  onNavigate: (href: string) => void;
}

interface ListsProps extends TournamentsProps {
  venueId: string;
  tournaments: readonly VenueTournament[];
  /** The panel open: `new`, a tournament's id, or none. */
  open: string | null;
  onOpen: (next: string | null) => void;
  exportIn: HTMLElement | null;
}

/** The two lists by tab, each with how many it holds, the table, and the panel that is open. */
function Lists({ venueId, tournaments, tab, onNavigate, open, onOpen, exportIn }: ListsProps) {
  const view: View = TABS.find((one) => one === tab) ?? 'upcoming';
  const upcoming = tournaments.filter((tournament) => !tournament.isPast);
  const past = tournaments.filter((tournament) => tournament.isPast);
  const isPast = view === 'past';
  const counts = { upcoming: upcoming.length, past: past.length };
  const opened = tournaments.find((tournament) => tournament.tournamentId === open);
  return (
    <Stack gap={4}>
      <Tabs label={t('console.tournaments.title')} current={view} onNavigate={onNavigate}
        tabs={TABS.map((id) => ({
          id, label: t(`console.tournaments.tabs.${id}`, { count: formatNumber(counts[id]) }), href: id === 'upcoming' ? '/tournaments' : `/tournaments?tab=${id}`,
        }))} />
      <DataTable key={view} exportIn={exportIn} label={t(isPast ? 'console.tournaments.pastLabel' : 'console.tournaments.label')} columns={columns()}
        rows={isPast ? past : upcoming} rowKey={(tournament) => tournament.tournamentId} density="comfortable" narrowLayout="scroll"
        filter={{ label: t('console.tournaments.search'), text: (tournament) => tournament.name }} {...(isPast ? { initialSort: LATEST_FIRST } : {})}
        onRowOpen={(tournament) => onOpen(tournament.tournamentId)} emptyText={t(isPast ? 'console.tournaments.pastEmpty' : 'console.tournaments.empty')} />
      {open === NEW ? <NewTournamentSheet venueId={venueId} onClose={() => onOpen(null)} /> : null}
      {opened === undefined ? null : <TournamentSheet key={opened.tournamentId} venueId={venueId} tournament={opened} onClose={() => onOpen(null)} />}
    </Stack>
  );
}

/** The screen once the staff member's venue is known. */
function Tournaments({ venueId, tab, onNavigate }: TournamentsProps & { venueId: string }) {
  const tournaments = useVenueTournaments(venueId);
  const [open, setOpen] = useState<string | null>(null);
  // A table alone on a screen has its Export beside the title (audit F-207).
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  const title = t('console.tournaments.title');
  const action = <Button variant="primary" size="compact" onClick={() => setOpen(NEW)}>{t('console.tournaments.newTournament')}</Button>;
  if (tournaments.data === undefined) {
    if (tournaments.isError) return <Screen title={title} status="error" onRetry={() => void tournaments.refetch()} />;
    return <Screen title={title} status="loading" loadingLook="rows" />;
  }
  return (
    <Screen title={title} actions={action} onActionsSlot={setExportIn}>
      <Lists venueId={venueId} tournaments={tournaments.data} tab={tab} onNavigate={onNavigate} open={open} onOpen={setOpen} exportIn={exportIn} />
    </Screen>
  );
}

/**
 * Tournaments, under Marketing (redesign RD-26), for staff who manage tournaments: those to come and those past, each with
 * its start, game, how many asked to be notified, how many were, and its entries. New tournament opens the panel at the
 * side; a row opens its record there, with who asked, Notify and Cancel tournament, or a past one's entries. No
 * registration, tickets or payments.
 */
export function TournamentsScreen(props: TournamentsProps) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <Tournaments venueId={staff.venue.venueId} {...props} />;
}
