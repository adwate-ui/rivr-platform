import { useFloorSeats, useFloorTables } from '@rivr/db';
import { useFnbActions, useFnbMenu, type FnbFailure } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, LoadState, QuantityStepper, Stack, StatusMessage, Switch, Text } from '@rivr/ui';
import { useState } from 'react';

/** Who sits where tonight, as choices: `Table 3, seat 5 · Yash Gupta`. */
function useSeatChoices(venueId: string) {
  const tables = useFloorTables().data ?? [];
  const seats = useFloorSeats(venueId).data ?? [];
  return seats.map((seated) => ({
    value: `${seated.tableId}:${String(seated.seat)}`,
    label: t('console.fnb.seatChoice', { table: tables.find((table) => table.id === seated.tableId)?.name ?? '', seat: seated.seat, name: seated.fullName }),
  }));
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
  const choices = useSeatChoices(venueId);
  const menu = useFnbMenu(venueId);
  const { order } = useFnbActions(venueId);
  const [chosen, setChosen] = useState<string | null>(null);
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [isComp, setIsComp] = useState(false);
  const [outcome, setOutcome] = useState<{ kot: number } | { failure: FnbFailure } | null>(null);
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const send = async () => {
    const [tableId = '', seat = '0'] = (chosen ?? '').split(':');
    const placed = await order.mutateAsync({ tableId, seat: Number(seat), lines, isComp });
    setOutcome(placed.ok ? { kot: placed.value.kotNumber } : { failure: placed.error });
    if (placed.ok) setCounts({});
  };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.fnb.newOrder')}</Heading>
      {choices.length === 0 ? <Text>{t('console.fnb.nobodySeated')}</Text> : (
        <ChoiceChips label={t('console.fnb.seat')} mode="one" options={choices} selected={chosen === null ? [] : [chosen]}
          onChange={([picked]) => setChosen(picked ?? null)} />
      )}
      <MenuSteppers menu={menu} counts={counts} onChange={(itemId, quantity) => { setCounts({ ...counts, [itemId]: quantity }); setOutcome(null); }} />
      <Switch label={t('console.fnb.isComp')} isOn={isComp} onChange={setIsComp} />
      <Button variant="secondary" isDisabled={chosen === null || lines.length === 0} isLoading={order.isPending} onClick={() => void send()}>
        {t('console.fnb.send')}
      </Button>
      <StatusMessage>{outcome !== null && 'kot' in outcome ? t('console.fnb.sent', { kot: outcome.kot }) : null}</StatusMessage>
      {outcome !== null && 'failure' in outcome ? <ErrorMessage>{t(`console.fnb.failures.${outcome.failure}`)}</ErrorMessage> : null}
    </Stack>
  );
}
