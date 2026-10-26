import { useMyLeague, type LeagueBoardRow } from '@rivr/db/myRewards';
import { formatMonth, formatNumber, t } from '@rivr/i18n';
import { Button, Heading, Inline, Stack, Text } from '@rivr/ui';

const nameOf = (row: LeagueBoardRow) => (row.isMe ? t('memberRewards.you') : row.name ?? t('memberRewards.hiddenName'));

/** One period's places: the top ten, and the member's own place below them when they are off it. */
function Standing({ title, rows }: { title: string; rows: readonly LeagueBoardRow[] }) {
  return (
    <Stack gap={3}>
      <Text variant="label" tone="muted">{title}</Text>
      <Stack gap={2} divided>
        {rows.map((row) => (
          <Inline key={`${row.place}-${row.isMe ? 'me' : row.name ?? ''}`} justify="between" align="center" gap={4}>
            <Text weight={row.isMe ? 'semibold' : 'regular'}>{t('memberRewards.placeLine', { place: row.place, name: nameOf(row) })}</Text>
            <Text variant="small" tone={row.isMe ? 'money' : 'muted'}>{t('memberRewards.leaguePoints', { points: formatNumber(row.points) })}</Text>
          </Inline>
        ))}
      </Stack>
    </Stack>
  );
}

function seasonTitle(row: LeagueBoardRow): string {
  return t('memberRewards.seasonLine', { name: row.seasonName ?? '', first: formatMonth(row.firstMonth), last: formatMonth(row.lastMonth) });
}

/** The RIVR League (#147; feature league.standings): this month's standings, and the season's when one runs. */
export function LeagueSection() {
  const league = useMyLeague();
  const heading = <Heading level={2}>{t('memberRewards.league')}</Heading>;
  if (league.data === undefined) {
    return (
      <Stack gap={3}>
        {heading}
        <Text tone="muted">{t(league.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {league.isError ? <Inline><Button onClick={() => void league.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  const month = league.data.filter((row) => row.standing === 'month');
  const season = league.data.filter((row) => row.standing === 'season');
  const first = season[0];
  return (
    <Stack gap={6}>
      {heading}
      {month.length === 0 ? <Text tone="muted">{t('memberRewards.noStandings')}</Text> : <Standing title={t('memberRewards.thisMonth')} rows={month} />}
      {first === undefined ? null : <Standing title={seasonTitle(first)} rows={season} />}
    </Stack>
  );
}
