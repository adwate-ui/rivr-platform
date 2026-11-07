import { useMyBonusHistory, type BonusLine } from '@rivr/db/bonus';
import type { Paise } from '@rivr/domain/money';
import { formatChips, formatDayMonth, t } from '@rivr/i18n';
import { BalanceTile, Box, Button, DetailRow, Heading, LoadState, Skeleton, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** A line's label and its signed chips: `Welcome bonus · 15 Nov` `+500`; `Buy-in · Table 3 · 15 Nov` `−1,000`. */
function lineCopy(line: BonusLine): { label: string; value: string } {
  const date = formatDayMonth(new Date(line.at));
  const chips = formatChips(line.amount);
  if (line.kind === 'credited') return { label: t('memberRewards.bonus.credited', { reason: line.reason ?? '', date }), value: t('memberRewards.bonus.plus', { chips }) };
  const value = t('memberRewards.bonus.minus', { chips });
  if (line.kind === 'expired') return { label: t('memberRewards.bonus.expired', { reason: line.reason ?? '', date }), value };
  return {
    label: line.tableName === null ? t('memberRewards.bonus.redeemedNoTable', { date }) : t('memberRewards.bonus.redeemed', { table: line.tableName, date }),
    value,
  };
}

/** The newest lines, with Show earlier while there may be more. */
function History() {
  const [count, setCount] = useState(PAGE);
  const history = useMyBonusHistory(count);
  if (history.isError) return <LoadState isError onRetry={() => void history.refetch()} />;
  if (history.data === undefined) return <Skeleton rows={3} />;
  if (history.data.length === 0) return <Text tone="muted">{t('memberRewards.bonus.noHistory')}</Text>;
  return (
    <Stack gap={2}>
      <Box>
        {history.data.map((line, index) => {
          const copy = lineCopy(line);
          return (
            <DetailRow key={line.id} label={copy.label} value={copy.value} valueTone={line.kind === 'credited' ? 'accent' : 'muted'}
              isLast={index === (history.data?.length ?? 0) - 1} />
          );
        })}
      </Box>
      {history.data.length < count ? null : (
        <Button variant="text" onClick={() => setCount(count + PAGE)}>{t('memberRewards.bonus.showEarlier')}</Button>
      )}
    </Stack>
  );
}

/**
 * The bonus chips tile beside points at the top of Rewards (decision 0504; owner, 8 Nov): the chips in gold with a chip,
 * and what they are for, or a skeleton while they come. It opens their history in place, closed until the member opens it.
 */
export function BonusTile({ chips, isOpen, onToggle }: { chips: Paise | undefined; isOpen: boolean; onToggle: () => void }) {
  if (chips === undefined) return <Skeleton rows={2} />;
  return (
    <BalanceTile icon="chip" tone="money" figure={formatChips(chips)} label={t('memberRewards.bonus.label')}
      line={t('memberRewards.bonus.line')} onOpen={onToggle} aria-expanded={isOpen} />
  );
}

/**
 * The bonus chips history, once opened from its tile: chips given with the promotion's name, chips used with a buy-in and
 * at which table, the newest first.
 */
export function BonusHistory() {
  return (
    <Stack gap={2}>
      <Heading level={2} variant="subsection">{t('memberRewards.bonus.history')}</Heading>
      <History />
    </Stack>
  );
}
