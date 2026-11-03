import type { MemberRow } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { DotStatus, Text, type DataTableColumn } from '@rivr/ui';
import type { Tonight } from './tonight.ts';

/** A member's place tonight as a dot and a short status (console v3): a seat, waiting, left, or a dash when not here. */
export function TonightStatus({ tonight }: { tonight: Tonight | undefined }) {
  if (tonight === undefined) return <Text tone="muted">{t('console.members.notHere')}</Text>;
  if (tonight.kind === 'seated') {
    const seat = { table: tonight.tableName, seat: tonight.seat };
    return <DotStatus tone="active" label={t('console.members.seatShort', seat)} title={t('console.members.seatFull', seat)} />;
  }
  // Waiting is gold, as on the door's list of today's players: someone at the club without a seat yet.
  return tonight.kind === 'waiting'
    ? <DotStatus tone="needsYou" label={t('console.members.waiting')} />
    : <DotStatus tone="inactive" label={t('console.members.left')} />;
}

/** Seated first, by table and seat, then waiting, left, and members not at the club. */
function tonightOrder(tonight: Tonight | undefined): string {
  if (tonight === undefined) return '3';
  if (tonight.kind === 'seated') return `0 ${tonight.tableName} ${String(tonight.seat).padStart(2, '0')}`;
  return tonight.kind === 'waiting' ? '1' : '2';
}

/** Members' columns (console v3): Name, No., Tier, Tonight and Visits; the name opens the record. */
export function memberColumns(tonight: ReadonlyMap<string, Tonight>): readonly DataTableColumn<MemberRow>[] {
  return [
    // Twice a share, so a name stays on one line beside the record (the screenshot index: "Kabir / Sethi").
    { key: 'name', header: t('console.members.name'), cell: (row) => row.fullName, sortValue: (row) => row.fullName, isWide: true },
    { key: 'number', header: t('console.members.number'), cell: (row) => <Text tone="muted">{String(row.memberNumber)}</Text>, sortValue: (row) => row.memberNumber },
    { key: 'tier', header: t('console.members.tier'), cell: (row) => row.tierName, sortValue: (row) => row.tierName },
    {
      key: 'tonight', header: t('console.members.tonight'), cell: (row) => <TonightStatus tonight={tonight.get(row.memberId)} />,
      sortValue: (row) => tonightOrder(tonight.get(row.memberId)), exportValue: (row) => tonightWords(tonight.get(row.memberId)),
    },
    { key: 'visits', header: t('console.members.visits'), cell: (row) => formatNumber(row.visits), sortValue: (row) => row.visits, align: 'end' },
  ];
}

/** Tonight in words for an export: `Table 2, seat 3`, `Waiting` or `Left`. */
function tonightWords(tonight: Tonight | undefined): string {
  if (tonight === undefined) return '';
  if (tonight.kind === 'seated') return t('console.members.seatFull', { table: tonight.tableName, seat: tonight.seat });
  return t(tonight.kind === 'waiting' ? 'console.members.waiting' : 'console.members.left');
}
