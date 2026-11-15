import { useMyBonusHistory, type BonusLine } from '@rivr/db/bonus';
import { formatChips, formatDayMonth, formatHighHand, t } from '@rivr/i18n';
import { Box, Button, DetailRow, Heading, LoadState, Skeleton, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** A line's label and its signed Bonus: `Welcome bonus · 15 Nov` `+500`; `High hand: Four Jacks · 15 Nov` `+5,000`; `Buy-in · Table 3 · 15 Nov` `−1,000`. */
function lineCopy(line: BonusLine): { label: string; value: string } {
  const date = formatDayMonth(new Date(line.at));
  const chips = formatChips(line.amount);
  if (line.kind === 'credited' && line.highHand !== null) {
    return { label: t('playerBonus.highHand', { hand: formatHighHand(line.highHand.hand, line.highHand.rank), date }), value: t('playerBonus.plus', { chips }) };
  }
  if (line.kind === 'credited') return { label: t('playerBonus.credited', { reason: line.reason ?? '', date }), value: t('playerBonus.plus', { chips }) };
  const value = t('playerBonus.minus', { chips });
  if (line.kind === 'expired') return { label: t('playerBonus.expired', { reason: line.reason ?? '', date }), value };
  return {
    label: line.tableName === null ? t('playerBonus.redeemedNoTable', { date }) : t('playerBonus.redeemed', { table: line.tableName, date }),
    value,
  };
}

/** The newest lines, with Show earlier while there may be more. */
function History() {
  const [count, setCount] = useState(PAGE);
  const history = useMyBonusHistory(count);
  // The page before: what is on screen stays if the next page fails.
  const shown = useMyBonusHistory(Math.max(PAGE, count - PAGE));
  const lines = history.data ?? shown.data;
  if (lines === undefined) return history.isError ? <LoadState isError onRetry={() => void history.refetch()} /> : <Skeleton rows={3} />;
  if (lines.length === 0) return <Text tone="muted">{t('playerBonus.noHistory')}</Text>;
  return (
    <Stack gap={2}>
      <Box>
        {lines.map((line, index) => {
          const copy = lineCopy(line);
          return (
            <DetailRow key={line.id} label={copy.label} value={copy.value} valueTone={line.kind === 'credited' ? 'default' : 'muted'}
              isLast={index === lines.length - 1} />
          );
        })}
      </Box>
      {history.isError ? <LoadState isError onRetry={() => void history.refetch()} /> : null}
      {lines.length < count ? null : (
        <Button variant="text" onClick={() => setCount(count + PAGE)}>{t('playerBonus.showEarlier')}</Button>
      )}
    </Stack>
  );
}

/**
 * The Bonus history: what was given, with the promotion's name, and what was used with a buy-in and at which table, the
 * newest first.
 */
export function BonusHistory() {
  return (
    <Stack gap={2}>
      <Heading level={2} variant="eyebrow">{t('playerBonus.history')}</Heading>
      <History />
    </Stack>
  );
}
