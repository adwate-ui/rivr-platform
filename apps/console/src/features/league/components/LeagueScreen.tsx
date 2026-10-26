import { useLeagueSeasons, useStaffVenue, type LeagueSeason } from '@rivr/db';
import { leagueMonth } from '@rivr/domain/league';
import { formatMonth, t } from '@rivr/i18n';
import { Button, ChoiceChips, Grid, Heading, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SeasonForm } from './SeasonForm.tsx';
import { StandingsTable } from './StandingsTable.tsx';

/** A period the standings cover: one League month, or a season's months. Months as their first day. */
interface Period {
  readonly value: string;
  readonly label: string;
  readonly firstMonth: string;
  readonly lastMonth: string;
}

/** The month `count` before `month` (`2026-11-01`), as its first day. */
function monthsBefore(month: string, count: number): string {
  const at = new Date(`${month}T00:00:00Z`);
  at.setUTCMonth(at.getUTCMonth() - count);
  return at.toISOString().slice(0, 10);
}

/** This League month and the two before it, then each season, latest first. */
function periodsFor(seasons: readonly LeagueSeason[]): Period[] {
  const thisMonth = leagueMonth(new Date());
  const months = [0, 1, 2].map((count) => monthsBefore(thisMonth, count)).map((month, index) => ({
    value: `month:${month}`, label: index === 0 ? t('console.league.thisMonth') : formatMonth(month), firstMonth: month, lastMonth: month,
  }));
  return [...months, ...seasons.map((season) => ({ value: `season:${season.id}`, label: season.name, firstMonth: season.firstMonth, lastMonth: season.lastMonth }))];
}

const seasonLine = (season: LeagueSeason) =>
  t('console.league.seasonLine', { name: season.name, first: formatMonth(season.firstMonth), last: formatMonth(season.lastMonth) });

function SeasonRow({ season, canKeep, onEdit }: { season: LeagueSeason; canKeep: boolean; onEdit: (season: LeagueSeason) => void }) {
  return (
    <Inline justify="between" align="center" gap={6}>
      <Text>{seasonLine(season)}</Text>
      {canKeep ? (
        <Button variant="text" aria-label={t('console.league.editSeason', { name: season.name })} onClick={() => onEdit(season)}>{t('console.league.edit')}</Button>
      ) : null}
    </Inline>
  );
}

/** The seasons, latest first, and for staff who keep them the form: a new season, or the one chosen. */
function Seasons({ venueId, seasons, canKeep }: { venueId: string; seasons: readonly LeagueSeason[]; canKeep: boolean }) {
  const [editing, setEditing] = useState<LeagueSeason | null>(null);
  return (
    <Stack gap={8}>
      <Stack gap={4}>
        <Heading level={2} variant="section">{t('console.league.seasons')}</Heading>
        {seasons.length === 0 ? <Text tone="muted">{t('console.league.noSeasons')}</Text> : (
          <Stack gap={3} divided>{seasons.map((season) => <SeasonRow key={season.id} season={season} canKeep={canKeep} onEdit={setEditing} />)}</Stack>
        )}
      </Stack>
      {canKeep ? <SeasonForm key={editing?.id ?? 'new'} venueId={venueId} season={editing} onDone={() => setEditing(null)} /> : null}
    </Stack>
  );
}

/** The standings for one period, chosen from this month, the two before and each season. */
function Standings({ venueId, seasons }: { venueId: string; seasons: readonly LeagueSeason[] }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const periods = periodsFor(seasons);
  const period = periods.find((option) => option.value === chosen) ?? periods[0];
  if (period === undefined) return null;
  return (
    <Stack gap={6}>
      <ChoiceChips label={t('console.league.period')} mode="one" selected={[period.value]} options={periods}
        onChange={(next) => { if (next[0] !== undefined) setChosen(next[0]); }} />
      <StandingsTable venueId={venueId} label={period.label} firstMonth={period.firstMonth} lastMonth={period.lastMonth} />
    </Stack>
  );
}

function LeagueBody({ venueId, canRead, canKeep }: { venueId: string; canRead: boolean; canKeep: boolean }) {
  const seasons = useLeagueSeasons(venueId);
  const title = t('console.league.title');
  if (seasons.isPending) return <Screen title={title} status="loading" />;
  if (seasons.data === undefined) return <Screen title={title} status="error" onRetry={() => void seasons.refetch()} />;
  return (
    <Screen title={title}>
      <Grid columns={2} gap={12}>
        {canRead ? <Standings venueId={venueId} seasons={seasons.data} /> : <Text tone="muted">{t('console.league.noNames')}</Text>}
        <Seasons venueId={venueId} seasons={seasons.data} canKeep={canKeep} />
      </Grid>
    </Screen>
  );
}

/**
 * The RIVR League (#147, decision 0182): for staff who read members, the standings this month, the two months
 * before, or a season, with cash and tournament points apart; and the seasons, which staff with
 * rewards.manage add and change.
 */
export function LeagueScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  const permissions = staff.venue.permissions;
  const canRead = permissions.includes('members.read');
  const canKeep = permissions.includes('rewards.manage');
  if (!canRead && !canKeep) {
    return <Screen title={t('console.league.title')} status="error" errorText={t('console.league.notAllowed')} />;
  }
  return <LeagueBody venueId={staff.venue.venueId} canRead={canRead} canKeep={canKeep} />;
}
