import { useMemberBonus, useMemberBonusHistory, type MemberBonusLine } from '@rivr/db/bonus';
import { formatChips, formatDate, t } from '@rivr/i18n';
import { Button, DetailRow, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { GiveBonusChips } from './GiveBonusChips.tsx';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** A line's label and signed chips: when, and what (the promotion's name, or the table and who seated the member). */
function lineCopy(line: MemberBonusLine): { label: string; value: string } {
  const date = formatDate(new Date(line.at));
  const chips = formatChips(line.amount);
  if (line.kind === 'credited') return { label: t('console.members.bonus.credited', { date, reason: line.reason ?? '' }), value: t('console.members.bonus.plus', { chips }) };
  const value = t('console.members.bonus.minus', { chips });
  if (line.kind === 'expired') return { label: t('console.members.bonus.expired', { date, reason: line.reason ?? '' }), value };
  const table = line.tableName ?? '';
  return {
    label: line.staffName === null ? t('console.members.bonus.redeemed', { date, table })
      : t('console.members.bonus.redeemedBy', { date, table, name: line.staffName }),
    value,
  };
}

/** The member's bonus history, the newest first, with Show earlier while there may be more. */
function BonusHistory({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [count, setCount] = useState(PAGE);
  const history = useMemberBonusHistory(venueId, memberId, count);
  if (history.isError) return <LoadState isError onRetry={() => void history.refetch()} />;
  if (history.data === undefined) return <LoadState />;
  if (history.data.length === 0) return <Text tone="muted">{t('console.members.bonus.none')}</Text>;
  const lines = history.data;
  return (
    <Stack gap={2}>
      <Stack gap={0}>
        {lines.map((line, index) => {
          const copy = lineCopy(line);
          return <DetailRow key={line.id} label={copy.label} value={copy.value} size="small" valueTone={line.kind === 'credited' ? 'accent' : 'muted'}
            isLast={index === lines.length - 1} />;
        })}
      </Stack>
      {lines.length < count ? null : <Button variant="text" size="small" onClick={() => setCount(count + PAGE)}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}

/**
 * Bonus chips on the member's record (decision 0504): what they have now and every line, the newest first. Chips are
 * redeemed in the seat sheets; a super admin adds some by hand (owner, 8 Nov).
 */
export function MemberBonus({ venueId, memberId, canGive }: { venueId: string; memberId: string; canGive: boolean }) {
  const balance = useMemberBonus(venueId, memberId);
  if (balance.isError) return <LoadState isError onRetry={() => void balance.refetch()} />;
  if (balance.data === undefined) return <LoadState />;
  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <DetailRow label={t('console.members.bonus.balance')} value={formatChips(balance.data ?? 0n)} labelTone="muted" size="small" isLast />
        <Text variant="small" tone="muted">{t('console.members.bonus.note')}</Text>
      </Stack>
      <Stack gap={2}>
        <Heading level={3}>{t('console.members.bonus.history')}</Heading>
        <BonusHistory venueId={venueId} memberId={memberId} />
      </Stack>
      {canGive ? <GiveBonusChips venueId={venueId} memberId={memberId} /> : null}
    </Stack>
  );
}
