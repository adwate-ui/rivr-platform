import {
  useBlindStructures, useStaffVenue, useTournamentTemplates, useVenueTournaments, type BlindStructure, type TournamentTemplate, type VenueTournament,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, SplitView, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { NewTournamentForm } from './NewTournamentForm.tsx';
import { StructuresView } from './StructuresView.tsx';
import { TemplatesView } from './TemplatesView.tsx';
import { TournamentDetail } from './TournamentDetail.tsx';
import { TournamentList } from './TournamentList.tsx';

const VIEWS = ['tournaments', 'templates', 'structures'] as const;
type View = (typeof VIEWS)[number];

/** The tournaments: the one chosen (the running one at first) with its clock, beside the list and a new tournament. */
interface Access {
  /** tournaments.manage: the clock, the floor's changes, templates and structures. */
  readonly canRun: boolean;
  /** cage.transact: buys taken in cash. */
  readonly canTakeCash: boolean;
}

interface ViewProps {
  venueId: string;
  tournaments: readonly VenueTournament[];
  templates: readonly TournamentTemplate[];
  access: Access;
}

function TournamentsView({ venueId, tournaments, templates, access }: ViewProps) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = tournaments.find((tournament) => tournament.id === chosenId) ?? tournaments[0];
  // The running one shows beside the list from 1180 px; below, the list stays until a tournament is chosen.
  return (
    <SplitView isChosen={chosenId !== null} onBack={() => setChosenId(null)} backLabel={t('console.tournaments.backToList')}
      emptyText={t('console.tournaments.chooseOne')}
      list={(
        <Stack gap={10}>
          {/* Marked only once chosen: the one shown by default stays open to a phone, whose list it is not beside. */}
          <TournamentList tournaments={tournaments} chosenId={chosenId === null ? undefined : chosen?.id} onChoose={setChosenId} />
          {access.canRun ? <NewTournamentForm venueId={venueId} templates={templates} onMade={setChosenId} /> : null}
        </Stack>
      )}
      detail={chosen === undefined ? null
        : <TournamentDetail key={chosen.id} venueId={venueId} tournament={chosen} tournaments={tournaments} canRun={access.canRun} canTakeCash={access.canTakeCash} />} />
  );
}

interface BodyData {
  tournaments: readonly VenueTournament[];
  templates: readonly TournamentTemplate[];
  structures: readonly BlindStructure[];
}

function ViewBody({ venueId, view, data, access }: { venueId: string; view: View; data: BodyData; access: Access }) {
  if (view === 'templates' && access.canRun) return <TemplatesView venueId={venueId} templates={data.templates} structures={data.structures} />;
  if (view === 'structures' && access.canRun) return <StructuresView venueId={venueId} structures={data.structures} />;
  return <TournamentsView venueId={venueId} tournaments={data.tournaments} templates={data.templates} access={access} />;
}

function TournamentsBody({ venueId, access }: { venueId: string; access: Access }) {
  const navigate = useNavigate();
  // The view open is in the address (`?tab=templates`), so a refresh, Back or a shared link opens it.
  const { tab } = useSearch({ from: '/frame/tournaments' });
  const view: View = VIEWS.find((one) => one === tab) ?? 'tournaments';
  const tournaments = useVenueTournaments(venueId);
  const templates = useTournamentTemplates(venueId);
  const structures = useBlindStructures(venueId);
  const title = t('console.tournaments.title');
  const queries = [tournaments, templates, structures];
  if (queries.some((query) => query.isPending)) return <Screen title={title} status="loading" />;
  if (tournaments.data === undefined || templates.data === undefined || structures.data === undefined) {
    return <Screen title={title} status="error" onRetry={() => queries.forEach((query) => void query.refetch())} />;
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {access.canRun ? (
          <Tabs label={t('console.tournaments.show')} current={view} onNavigate={(href) => void navigate({ href })}
            tabs={VIEWS.map((id) => ({ id, label: t(`console.tournaments.views.${id}`), href: `/tournaments?tab=${id}` }))} />
        ) : null}
        <ViewBody venueId={venueId} view={view} access={access}
          data={{ tournaments: tournaments.data, templates: templates.data, structures: structures.data }} />
      </Stack>
    </Screen>
  );
}

/**
 * Tournaments (#115, #116, #118, #119, #120), for staff who run them: the clock and its controls, the floor, the
 * tournaments and a new one from a template, the templates, and the blind structures with their calculator. A
 * cashier sees the tournaments and their floor, and takes buys in cash.
 */
export function TournamentsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  const access = { canRun: staff.venue.permissions.includes('tournaments.manage'), canTakeCash: staff.venue.permissions.includes('cage.transact') };
  if (!access.canRun && !access.canTakeCash) {
    return <Screen title={t('console.tournaments.title')} status="error" errorText={t('console.tournaments.notAllowed')} />;
  }
  return <TournamentsBody venueId={staff.venue.venueId} access={access} />;
}
