import { usePotData, useStaffVenue, type PotHand, type PotVariant } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import { formatDayTime, formatMoney, formatNumber, formatRupeesForFile, t, type MessageKey } from '@rivr/i18n';
import { ChoiceChips, DataTable, ErrorMessage, Inline, Input, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useMemo, useState } from 'react';

const VARIANT_COPY: Readonly<Record<PotVariant, MessageKey>> = {
  holdem: 'console.liveFloor.holdem', plo: 'console.liveFloor.plo', bomb_pot: 'console.liveFloor.bombPot',
};
// The most the database reads at once (pot_data): a full screen means the period holds more.
const MOST = 5_000;

const highHandText = (hand: PotHand) => {
  if (hand.highHand === 'royal_flush' || hand.highHand === 'straight_flush' || hand.highHand === 'four_of_a_kind') return t(`tv.highHand.${hand.highHand}`);
  return t('console.potData.noHighHand');
};

function columns(): readonly DataTableColumn<PotHand>[] {
  return [
    { key: 'when', header: t('console.potData.when'), cell: (hand) => formatDayTime(new Date(hand.playedAt)), sortValue: (hand) => hand.playedAt },
    { key: 'table', header: t('console.potData.table'), cell: (hand) => hand.tableName, sortValue: (hand) => hand.tableName },
    { key: 'dealer', header: t('console.potData.dealer'), cell: (hand) => hand.dealerName, sortValue: (hand) => hand.dealerName },
    { key: 'variant', header: t('console.potData.variant'), cell: (hand) => t(VARIANT_COPY[hand.variant]) },
    { key: 'pot', header: t('console.potData.pot'), align: 'end', cell: (hand) => formatMoney(hand.pot), sortValue: (hand) => hand.pot,
      exportValue: (hand) => Number(formatRupeesForFile(hand.pot)) },
    { key: 'rake', header: t('console.potData.rake'), align: 'end', cell: (hand) => formatMoney(hand.rake), sortValue: (hand) => hand.rake,
      exportValue: (hand) => Number(formatRupeesForFile(hand.rake)) },
    { key: 'drop', header: t('console.potData.drop'), align: 'end', cell: (hand) => formatMoney(hand.drop), sortValue: (hand) => hand.drop,
      exportValue: (hand) => Number(formatRupeesForFile(hand.drop)) },
    { key: 'cap', header: t('console.potData.cap'), cell: (hand) => t(hand.isCapApplied ? 'console.potData.capYes' : 'console.potData.capNo') },
    { key: 'highHand', header: t('console.potData.highHand'), cell: highHandText },
  ];
}

/** A filter of one value or all: the options are those in the hands read. */
function Filter({ label, values, chosen, onChange }: { label: string; values: readonly { value: string; label: string }[]; chosen: string; onChange: (value: string) => void }) {
  return (
    <ChoiceChips label={label} mode="one" selected={[chosen]} options={[{ value: '', label: t('console.potData.all') }, ...values]}
      onChange={(next) => onChange(next[0] ?? '')} />
  );
}

/** Each value once, by its label: the tables, dealers or variants among the hands. */
function optionsOf(hands: readonly PotHand[], pick: (hand: PotHand) => { value: string; label: string }) {
  const seen = new Map(hands.map((hand) => [pick(hand).value, pick(hand)]));
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** The filters in force, in words, as an export records them: the days, and any table, dealer or game chosen. */
function filtersInWords(hands: readonly PotHand[], filter: { table: string; dealer: string; variant: string }, from: string, to: string): string {
  const choice = (label: string, value: string | undefined) => (value === undefined ? [] : [t('console.exportFilters.choice', { label, value })]);
  const table = hands.find((hand) => hand.tableId === filter.table)?.tableName;
  const dealer = hands.find((hand) => hand.dealerId === filter.dealer)?.dealerName;
  const chosenVariant = hands.find((hand) => hand.variant === filter.variant)?.variant;
  const variant = chosenVariant === undefined ? undefined : t(VARIANT_COPY[chosenVariant]);
  return [
    t('console.exportFilters.period', { from, to }), ...choice(t('console.potData.table'), table),
    ...choice(t('console.potData.dealer'), dealer), ...choice(t('console.potData.variant'), variant),
  ].join('; ');
}

function Hands({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const hands = usePotData(venueId, from, to);
  const [filter, setFilter] = useState({ table: '', dealer: '', variant: '' });
  const shown = useMemo(() => columns(), []);
  const base = { label: t('console.potData.hands'), columns: shown, rowKey: (hand: PotHand) => hand.handId };
  if (hands.data === undefined && hands.isError) return <DataTable {...base} status="error" onRetry={() => void hands.refetch()} />;
  if (hands.data === undefined) return <DataTable {...base} status="loading" />;
  const rows = hands.data.filter((hand) => (filter.table === '' || hand.tableId === filter.table) && (filter.dealer === '' || hand.dealerId === filter.dealer)
    && (filter.variant === '' || hand.variant === filter.variant));
  return (
    <Stack gap={4}>
      <Filter label={t('console.potData.table')} chosen={filter.table} onChange={(table) => setFilter({ ...filter, table })}
        values={optionsOf(hands.data, (hand) => ({ value: hand.tableId, label: hand.tableName }))} />
      <Filter label={t('console.potData.dealer')} chosen={filter.dealer} onChange={(dealer) => setFilter({ ...filter, dealer })}
        values={optionsOf(hands.data, (hand) => ({ value: hand.dealerId, label: hand.dealerName }))} />
      <Filter label={t('console.potData.variant')} chosen={filter.variant} onChange={(variant) => setFilter({ ...filter, variant })}
        values={optionsOf(hands.data, (hand) => ({ value: hand.variant, label: t(VARIANT_COPY[hand.variant]) }))} />
      {hands.data.length >= MOST ? <Text tone="muted">{t('console.potData.tooMany', { count: formatNumber(MOST) })}</Text> : null}
      <DataTable {...base} rows={rows} emptyText={t('console.potData.noHands')} exportFilter={filtersInWords(hands.data, filter, from, to)} />
    </Stack>
  );
}

function PotDataBody({ venueId }: { venueId: string }) {
  const [period, setPeriod] = useState(() => ({ from: clubDay(new Date()), to: clubDay(new Date()) }));
  const isValid = period.from !== '' && period.to !== '' && period.from <= period.to;
  return (
    <Screen title={t('console.potData.title')}>
      <Stack gap={6}>
        <Inline gap={4} align="start" wrap>
          <Input type="date" label={t('console.potData.from')} hint={t('console.potData.periodHint')} value={period.from}
            onChange={(event) => setPeriod({ ...period, from: event.target.value })} />
          <Input type="date" label={t('console.potData.to')} value={period.to} onChange={(event) => setPeriod({ ...period, to: event.target.value })} />
        </Inline>
        {/* A new period starts its filters afresh: a table or dealer chosen before may have no hands in it. */}
        {isValid ? <Hands key={`${period.from}:${period.to}`} venueId={venueId} from={period.from} to={period.to} /> : <ErrorMessage>{t('console.potData.invalidPeriod')}</ErrorMessage>}
      </Stack>
    </Screen>
  );
}

/**
 * Pot data (#114; features "Pot data"; decision 0185): every hand from the tablets over the club's days
 * chosen, by table, dealer and variant, for the super admin (pot_data.read). The export is the DataTable's,
 * once #102 gives it one.
 */
export function PotDataScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('pot_data.read')) {
    return <Screen title={t('console.potData.title')} status="error" errorText={t('console.potData.notAllowed')} />;
  }
  return <PotDataBody venueId={staff.venue.venueId} />;
}
