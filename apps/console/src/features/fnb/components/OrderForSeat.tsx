import { useFloorSeats, useFloorTables } from '@rivr/db';
import { useFnbActions, useFnbMenu, type FnbFailure } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, LoadState, QuantityStepper, Stack, StatusMessage, Switch, Text } from '@rivr/ui';
import { useState } from 'react';

/** Who sits where tonight, as choices: `Table 3, seat 5 · Yash Gupta`; no choices until both floor reads have answered. */
function useSeatChoices(venueId: string) {
  const tables = useFloorTables();
  const seats = useFloorSeats(venueId);
  const retry = () => {
    void tables.refetch();
    void seats.refetch();
  };
  const tableRows = tables.data;
  if (tableRows === undefined || seats.data === undefined) return { choices: undefined, isError: tables.isError || seats.isError, retry };
  const choices = seats.data.map((seated) => ({
    value: `${seated.tableId}:${String(seated.seat)}`,
    label: t('console.fnb.seatChoice', { table: tableRows.find((table) => table.id === seated.tableId)?.name ?? '', seat: seated.seat, name: seated.fullName }),
  }));
  return { choices, isError: false, retry };
}

interface SeatChooserProps {
  seats: ReturnType<typeof useSeatChoices>;
  chosen: string | null;
  onChoose: (picked: string | null) => void;
}

/** The seated players to order for; or the floor's loading or error line, or that nobody is seated (F2-11). */
function SeatChooser({ seats, chosen, onChoose }: SeatChooserProps) {
  if (seats.choices === undefined) return <LoadState isError={seats.isError} onRetry={seats.retry} />;
  if (seats.choices.length === 0) return <Text>{t('console.fnb.nobodySeated')}</Text>;
  return (
    <ChoiceChips label={t('console.fnb.seat')} mode="one" options={seats.choices} selected={chosen === null ? [] : [chosen]}
      onChange={([picked]) => onChoose(picked ?? null)} />
  );
}

interface MenuStepperProps {
  menu: ReturnType<typeof useFnbMenu>;
  counts: Readonly<Record<string, number>>;
  onChange: (itemId: string, quantity: number) => void;
}

/** The venue's menu, how many of each item; or its loading, error or empty line. */
function MenuSteppers({ menu, counts, onChange }: MenuStepperProps) {
  if (menu.data === undefined) return <LoadState isError={menu.isError} onRetry={() => void menu.refetch()} />;
  if (menu.data.length === 0) return <Text>{t('console.fnb.empty')}</Text>;
  return menu.data.map((item) => (
    <QuantityStepper key={item.itemId} label={item.name} value={counts[item.itemId] ?? 0} onChange={(quantity) => onChange(item.itemId, quantity)} />
  ));
}

/** Orders for a seat from the console, paid or comp: a comp is RIVR's cost, at Glaza's price through the monthly import. */
export function OrderForSeat({ venueId }: { venueId: string }) {
  const seats = useSeatChoices(venueId);
  const menu = useFnbMenu(venueId);
  const { order } = useFnbActions(venueId);
  const [chosen, setChosen] = useState<string | null>(null);
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [isComp, setIsComp] = useState(false);
  const [outcome, setOutcome] = useState<{ kot: number } | { failure: FnbFailure } | null>(null);
  // One id an order, kept to retry one whose answer was lost, and new with any change to it (A3).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const renew = () => setRequestId(crypto.randomUUID());
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const send = async () => {
    const [tableId = '', seat = '0'] = (chosen ?? '').split(':');
    const placed = await order.mutateAsync({ tableId, seat: Number(seat), lines, isComp, requestId });
    if (placed.ok || placed.error !== 'unavailable') renew();
    setOutcome(placed.ok ? { kot: placed.value.kotNumber } : { failure: placed.error });
    // The next order starts afresh: not comped, and for a seat chosen again, as it may have changed hands (F2-20).
    if (placed.ok) { setCounts({}); setIsComp(false); setChosen(null); }
  };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.fnb.newOrder')}</Heading>
      <SeatChooser seats={seats} chosen={chosen} onChoose={(picked) => { setChosen(picked); renew(); }} />
      <MenuSteppers menu={menu} counts={counts} onChange={(itemId, quantity) => { setCounts({ ...counts, [itemId]: quantity }); setOutcome(null); renew(); }} />
      <Switch label={t('console.fnb.isComp')} isOn={isComp} onChange={(comp) => { setIsComp(comp); renew(); }} />
      <Button variant="secondary" isDisabled={chosen === null || lines.length === 0} isLoading={order.isPending} onClick={() => void send()}>
        {t('console.fnb.send')}
      </Button>
      <StatusMessage>{outcome !== null && 'kot' in outcome ? t('console.fnb.sent', { kot: outcome.kot }) : null}</StatusMessage>
      {outcome !== null && 'failure' in outcome ? <ErrorMessage>{t(`console.fnb.failures.${outcome.failure}`)}</ErrorMessage> : null}
    </Stack>
  );
}
