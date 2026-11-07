import { useMemberPointsOf } from '@rivr/db';
import { useMemberBonus, useMemberBonusHistory, type MemberBonusLine } from '@rivr/db/bonus';
import { formatChips, formatDate, formatNumber, t } from '@rivr/i18n';
import { BalanceTile, Button, DetailRow, Grid, Heading, LoadState, Stack, Text } from '@rivr/ui';
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

/** The two balances apart, each its own tile, as Rewards shows them to the member: points, then bonus chips. */
function BalanceTiles({ chips, points }: { chips: bigint; points: { readonly earned: bigint; readonly locked: bigint } | null }) {
  const locked = points?.locked ?? 0n;
  const pointsLine = locked > 0n ? t('console.members.bonus.pointsLineLocked', { locked: formatNumber(locked) }) : t('console.members.bonus.pointsLine');
  return (
    <Grid columns={2} gap={4}>
      <BalanceTile icon="star" figure={formatNumber(points?.earned ?? 0n)} label={t('console.members.bonus.pointsLabel')} line={pointsLine} />
      <BalanceTile icon="chip" tone="money" figure={formatChips(chips)} label={t('console.members.bonus.chipsLabel')} line={t('console.members.bonus.chipsLine')} />
    </Grid>
  );
}

/** The member's points and bonus chips now, or their loading or error state. */
function Balances({ venueId, memberId }: { venueId: string; memberId: string }) {
  const balance = useMemberBonus(venueId, memberId);
  const points = useMemberPointsOf(venueId, memberId);
  if (balance.isError || points.isError) return <LoadState isError onRetry={() => { void balance.refetch(); void points.refetch(); }} />;
  if (balance.data === undefined || points.data === undefined) return <LoadState />;
  return <BalanceTiles chips={balance.data ?? 0n} points={points.data} />;
}

/**
 * Points and bonus chips on the member's record (decision 0504; owner, 8 Nov): each balance its own tile, as Rewards shows
 * them to the member (points cream with a star, to spend on rewards; bonus chips gold with a chip, used with a buy-in),
 * then every bonus line, the newest first. Chips are redeemed in the seat sheets; a super admin adds some by hand.
 */
export function MemberBonus({ venueId, memberId, canGive }: { venueId: string; memberId: string; canGive: boolean }) {
  return (
    <Stack gap={6}>
      <Balances venueId={venueId} memberId={memberId} />
      <Stack gap={2}>
        <Heading level={3}>{t('console.members.bonus.history')}</Heading>
        <BonusHistory venueId={venueId} memberId={memberId} />
      </Stack>
      {canGive ? <GiveBonusChips venueId={venueId} memberId={memberId} /> : null}
    </Stack>
  );
}
