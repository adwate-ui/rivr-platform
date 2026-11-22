import { useMemberBonus, useMemberBonusHistory, type MemberBonusLine } from '@rivr/db/bonus';
import { formatChips, formatDate, t } from '@rivr/i18n';
import { BalanceTile, Button, DetailRow, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { AddBonusUse } from './AddBonusUse.tsx';
import { GiveBonusChips } from './GiveBonusChips.tsx';
import { ReverseBonus, type Reversing } from './ReverseBonus.tsx';
import { UseBonus } from './UseBonus.tsx';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** The label of Bonus that went out: reversed (by whom), expired, used without a seat (why, by whom) or at a table (who seated the member). */
function outLabel(line: MemberBonusLine, date: string): string {
  const reason = line.reason ?? '';
  if (line.kind === 'reversed') {
    return line.staffName === null ? t('console.members.bonus.reversed', { date, reason }) : t('console.members.bonus.reversedBy', { date, reason, name: line.staffName });
  }
  if (line.kind === 'expired') return t('console.members.bonus.expired', { date, reason });
  if (line.tableName === null) return t('console.members.bonus.used', { date, reason, name: line.staffName ?? '' });
  const table = line.tableName;
  // A use added after the fact (#1077): its reason, and who added it, not who seated the member.
  if (line.reason !== null) return t('console.members.bonus.redeemedAdded', { date, table, reason, name: line.staffName ?? '' });
  return line.staffName === null ? t('console.members.bonus.redeemed', { date, table }) : t('console.members.bonus.redeemedBy', { date, table, name: line.staffName });
}

/** A line's label and signed chips: when, and what (the promotion's name, or the table and who seated the member). */
function lineCopy(line: MemberBonusLine): { label: string; value: string } {
  const date = formatDate(new Date(line.at));
  const chips = formatChips(line.amount);
  if (line.kind === 'credited') return { label: t('console.members.bonus.credited', { date, reason: line.reason ?? '' }), value: t('console.members.bonus.plus', { chips }) };
  return { label: outLabel(line, date), value: t('console.members.bonus.minus', { chips }) };
}

/**
 * The member's bonus history, the newest first, with Show earlier while there may be more. With `onReverse` (a super admin,
 * #1077) each Bonus given opens to reverse it, unless it was reversed or all of it expired; its reversal and its expiry are
 * newer than it and carry its id, so they are on the page too.
 */
function BonusHistory({ venueId, memberId, onReverse }: { venueId: string; memberId: string; onReverse: ((reversing: Reversing) => void) | null }) {
  const [count, setCount] = useState(PAGE);
  const history = useMemberBonusHistory(venueId, memberId, count);
  if (history.isError) return <LoadState isError onRetry={() => void history.refetch()} />;
  if (history.data === undefined) return <LoadState />;
  if (history.data.length === 0) return <Text tone="muted">{t('console.members.bonus.none')}</Text>;
  const lines = history.data;
  const reversed = new Set(lines.filter((line) => line.kind === 'reversed').map((line) => line.id));
  const expired = new Map(lines.filter((line) => line.kind === 'expired').map((line) => [line.id, line]));
  const isReversible = (line: MemberBonusLine) => line.kind === 'credited' && !reversed.has(line.id) && expired.get(line.id)?.amount !== line.amount;
  return (
    <Stack gap={2}>
      <Stack gap={0}>
        {lines.map((line, index) => {
          const copy = lineCopy(line);
          const opens = onReverse !== null && isReversible(line);
          // A grant's own lines (given, expired, reversed) share its id: the kind keeps each row's key its own.
          return <DetailRow key={`${line.kind}:${line.id}`} label={copy.label} value={copy.value} size="small" valueTone={line.kind === 'credited' ? 'accent' : 'muted'}
            isLast={index === lines.length - 1} onOpen={opens ? () => onReverse({ line, expired: expired.get(line.id) ?? null }) : undefined}
            openHint={opens ? t('console.members.bonus.reverse.openHint') : undefined} />;
        })}
      </Stack>
      {lines.length < count ? null : <Button variant="text" size="small" onClick={() => setCount(count + PAGE)}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}

/** The member's bonus chips now, or their loading or error state. */
function Balance({ venueId, memberId }: { venueId: string; memberId: string }) {
  const balance = useMemberBonus(venueId, memberId);
  if (balance.isError) return <LoadState isError onRetry={() => void balance.refetch()} />;
  if (balance.data === undefined) return <LoadState />;
  return (
    <BalanceTile icon="chip" tone={(balance.data ?? 0n) < 0n ? 'default' : 'money'} figure={formatChips(balance.data ?? 0n)} label={t('console.members.bonus.chipsLabel')}
      line={(balance.data ?? 0n) < 0n ? t('console.members.bonus.owedLine') : t('console.members.bonus.chipsLine')} />
  );
}

/**
 * Bonus chips on the member's record (decision 0504; owner, 8 Nov): the balance on its tile (gold with a chip, used with a
 * buy-in; below zero while some is owed), then, for staff with bonus.give (`canGive`), Bonus to add by hand (redesign of 15
 * Nov) and to use without a seat (the owner, 20 Nov); for super admins and cashiers (`canCorrect`, bonus.correct, #1077; the owner, 22 Nov), a use a seat missed, and
 * Reverse on each Bonus given; and every line of bonus chips, the newest first. Chips are redeemed in the seat sheets.
 */
export function MemberBonus({ venueId, memberId, canGive, canCorrect }: { venueId: string; memberId: string; canGive: boolean; canCorrect: boolean }) {
  const [reversing, setReversing] = useState<Reversing | null>(null);
  return (
    <Stack gap={6}>
      <Balance venueId={venueId} memberId={memberId} />
      {canGive ? <GiveBonusChips venueId={venueId} memberId={memberId} /> : null}
      {canGive ? <UseBonus venueId={venueId} memberId={memberId} /> : null}
      {canCorrect ? <AddBonusUse venueId={venueId} memberId={memberId} /> : null}
      <Stack gap={2}>
        <Heading level={3}>{t('console.members.bonus.history')}</Heading>
        <BonusHistory venueId={venueId} memberId={memberId} onReverse={canCorrect ? setReversing : null} />
      </Stack>
      {reversing === null ? null : <ReverseBonus venueId={venueId} memberId={memberId} reversing={reversing} onClose={() => setReversing(null)} />}
    </Stack>
  );
}
