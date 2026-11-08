import { useFeature, useMyNextPlayTimeBonus } from '@rivr/db';
import { formatHoursMinutes, formatNumber, t } from '@rivr/i18n';
import { Box, FeatureGate, Inline, ProgressBar, Stack, Text } from '@rivr/ui';

/**
 * How close the member is to the next play-time bonus on this seat (audit F-173), laid out as Rewards' next reward. Nothing
 * while none is counting (the server gives none without promotions.feed), and in the last minute it says one minute, as the
 * sweep pays on the minute.
 */
export function NextBonusChips() {
  const feed = useFeature('promotions.feed');
  const next = useMyNextPlayTimeBonus().data ?? null;
  if (next === null) return null;
  return (
    <FeatureGate access={feed}>
      <Box paddingX={5}>
        <Stack gap={2}>
          <Inline justify="between" gap={3}>
            <Text variant="small">{t('player.live.seated.nextBonus', { chips: formatNumber(next.chips) })}</Text>
            <Text variant="small" tone="muted">{t('player.live.seated.nextBonusIn', { time: formatHoursMinutes(Math.max(60, next.secondsLeft)) })}</Text>
          </Inline>
          <ProgressBar fraction={1 - next.secondsLeft / (next.afterMinutes * 60)} />
        </Stack>
      </Box>
    </FeatureGate>
  );
}
