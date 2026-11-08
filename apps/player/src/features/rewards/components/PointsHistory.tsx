import { useMyPointsHistory, type PointsLine } from '@rivr/db/pointsHistory';
import { formatDayMonth, formatNumber, t } from '@rivr/i18n';
import { Box, Button, DetailRow, Heading, LoadState, Skeleton, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

const LABEL = { earned: 'line', spent: 'line', returned: 'line', locked: 'locked', released: 'released' } as const;

/** A line's label and its signed points: `Points for the visit · 15 Nov` `+250`; `Redeemed: RIVR cap · 15 Nov` `−500`. */
function lineCopy(line: PointsLine): { label: string; value: string } {
  const label = t(`memberRewards.pointsHistory.${LABEL[line.kind]}`, { reason: line.reason, date: formatDayMonth(new Date(line.at)) });
  const points = formatNumber(line.points);
  return { label, value: line.kind === 'spent' ? t('memberRewards.pointsHistory.minus', { points }) : t('memberRewards.pointsHistory.plus', { points }) };
}

/** The newest lines, with Show earlier while there may be more. */
function History() {
  const [count, setCount] = useState(PAGE);
  const history = useMyPointsHistory(count);
  // The page before: what is on screen stays if the next page fails.
  const shown = useMyPointsHistory(Math.max(PAGE, count - PAGE));
  const lines = history.data ?? shown.data;
  if (lines === undefined) return history.isError ? <LoadState isError onRetry={() => void history.refetch()} /> : <Skeleton rows={3} />;
  if (lines.length === 0) return <Text tone="muted">{t('memberRewards.pointsHistory.none')}</Text>;
  return (
    <Stack gap={2}>
      <Box>
        {lines.map((line, index) => {
          const copy = lineCopy(line);
          return (
            <DetailRow key={line.id} label={copy.label} value={copy.value} valueTone={line.kind === 'spent' || line.kind === 'locked' ? 'muted' : 'default'}
              isLast={index === lines.length - 1} />
          );
        })}
      </Box>
      {history.isError ? <LoadState isError onRetry={() => void history.refetch()} /> : null}
      {lines.length < count ? null : (
        <Button variant="text" onClick={() => setCount(count + PAGE)}>{t('memberRewards.bonus.showEarlier')}</Button>
      )}
    </Stack>
  );
}

/**
 * The points history, once opened from the points tile (F-054): each visit, promotion and gift by hand, each reward spent
 * and any points back, locked or released, the newest first. Feature rewards.points_history, gated where it is opened.
 */
export function PointsHistory() {
  return (
    <Stack gap={2}>
      <Heading level={2} variant="eyebrow">{t('memberRewards.pointsHistory.title')}</Heading>
      <History />
    </Stack>
  );
}
