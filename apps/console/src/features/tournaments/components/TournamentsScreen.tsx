import {
  useBlindStructures, useStaffVenue, useTournamentTemplates, useVenueTournaments, type BlindStructure, type TournamentTemplate, type VenueTournament,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, Grid, Screen, Stack, Text } from '@rivr/ui';
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
  return (
    <Grid columns={2} gap={12}>
      {chosen === undefined ? <Text tone="muted">{t('console.tournaments.none')}</Text>
        : <TournamentDetail key={chosen.id} venueId={venueId} tournament={chosen} canRun={access.canRun} canTakeCash={access.canTakeCash} />}
      <Stack gap={10}>
        <TournamentList tournaments={tournaments} chosenId={chosen?.id} onChoose={setChosenId} />
        {access.canRun ? <NewTournamentForm venueId={venueId} templates={templates} onMade={setChosenId} /> : null}
      </Stack>
    </Grid>
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
  const [view, setView] = useState<View>('tournaments');
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
          <ChoiceChips label={t('console.tournaments.show')} mode="one" selected={[view]}
            options={VIEWS.map((value) => ({ value, label: t(`console.tournaments.views.${value}`) }))}
            onChange={(next) => { if (next[0] !== undefined) setView(next[0]); }} />
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
