import { useFeature, type MyTonight } from '@rivr/db';
import { formatDate, formatMoney, formatTime, t } from '@rivr/i18n';
import { FeatureGate, Grid, Money, Stack, Text } from '@rivr/ui';

/**
 * The bad-beat jackpot, with the live floor, and the next tournament at the member's venue, with
 * tournament registration (#87, decision 0116), side by side above tonight's tables.
 */
export function TonightHighlights({ tonight }: { tonight: MyTonight }) {
  const liveView = useFeature('floor.live_view');
  const tournaments = useFeature('tournaments.register');
  const next = tonight.nextTournament;
  const startsAt = next ? new Date(next.startsAt) : null;
  return (
    <Grid columns={2} gap={4}>
      <FeatureGate access={liveView}>
        <Stack gap={1}>
          <Text variant="small" tone="muted">{t('player.tonight.jackpot')}</Text>
          <Money paise={tonight.jackpot ?? 0n} />
        </Stack>
      </FeatureGate>
      {next && startsAt ? (
        <FeatureGate access={tournaments}>
          <Stack gap={1}>
            <Text variant="small" tone="muted">{t('player.tonight.nextTournament')}</Text>
            <Text weight="medium">{next.name}</Text>
            <Text variant="small" tone="muted">
              {t('player.tonight.tournamentWhen', { date: formatDate(startsAt), time: formatTime(startsAt), buyIn: formatMoney(next.buyIn) })}
            </Text>
            {next.guarantee === null ? null : <Text variant="small" tone="muted">{t('player.tonight.guaranteed', { amount: formatMoney(next.guarantee) })}</Text>}
          </Stack>
        </FeatureGate>
      ) : null}
    </Grid>
  );
}
