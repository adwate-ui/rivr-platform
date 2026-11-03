import { useFnbActions, useFnbMenu, type FnbFailure } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, LoadState, QuantityStepper, Sheet, Skeleton, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { OrderSeatPicker } from './OrderSeatPicker.tsx';

interface MenuStepperProps {
  menu: ReturnType<typeof useFnbMenu>;
  counts: Readonly<Record<string, number>>;
  onChange: (itemId: string, quantity: number) => void;
}

/** The venue's menu, how many of each item; rows while it loads, or its error or empty line. */
function MenuSteppers({ menu, counts, onChange }: MenuStepperProps) {
  if (menu.data === undefined) return menu.isError ? <LoadState isError onRetry={() => void menu.refetch()} /> : <Skeleton look="rows" rows={3} />;
  if (menu.data.length === 0) return <Text tone="muted">{t('console.fnb.empty')}</Text>;
  return (
    <Stack gap={2} divided>
      {menu.data.map((item) => (
        <QuantityStepper key={item.itemId} look="console" label={item.name} value={counts[item.itemId] ?? 0} onChange={(quantity) => onChange(item.itemId, quantity)} />
      ))}
    </Stack>
  );
}

/** The order being made: where it goes, how many of each item, and comp; one request id until it changes (A3). */
function useDraft() {
  const [tableId, setTableId] = useState<string | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [isComp, setIsComp] = useState(false);
  // One id an order, kept to retry one whose answer was lost, and new with any change to it (A3).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const renew = () => setRequestId(crypto.randomUUID());
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  return {
    tableId, seat, counts, isComp, requestId, lines, renew,
    chooseTable: (picked: string | null) => { setTableId(picked); setSeat(null); renew(); },
    chooseSeat: (picked: number | null) => { setSeat(picked); renew(); },
    count: (itemId: string, quantity: number) => { setCounts({ ...counts, [itemId]: quantity }); renew(); },
    comp: (comp: boolean) => { setIsComp(comp); renew(); },
  };
}

interface NewOrderSheetProps {
  venueId: string;
  isOpen: boolean;
  /** Comp is for staff who run F&B: staff who serve order paid only (decision 0302). */
  canComp: boolean;
  onClose: () => void;
  /** The order reached the bar, as this KOT. */
  onSent: (kot: number) => void;
}

/**
 * New order (console v3), in a side sheet: the table, then the seat and who sits there, then the items with steppers,
 * Comp it for staff who run F&B, and Send to the bar. The caller keys it by each opening, so it opens empty.
 */
export function NewOrderSheet({ venueId, isOpen, canComp, onClose, onSent }: NewOrderSheetProps) {
  const menu = useFnbMenu(venueId);
  const { order } = useFnbActions(venueId);
  const draft = useDraft();
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const send = async () => {
    const placed = await order.mutateAsync({ tableId: draft.tableId ?? '', seat: draft.seat ?? 0, lines: draft.lines, isComp: draft.isComp, requestId: draft.requestId });
    if (placed.ok || placed.error !== 'unavailable') draft.renew();
    setFailure(placed.ok ? null : placed.error);
    if (placed.ok) onSent(placed.value.kotNumber);
  };
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('console.fnb.cancel')}</Button>
      <Button variant="primary" size="compact" isDisabled={draft.seat === null || draft.lines.length === 0} isLoading={order.isPending}
        onClick={() => void send()}>{t('console.fnb.send')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen={isOpen} onClose={onClose} title={t('console.fnb.newOrder')} footer={footer}>
      <Stack gap={6}>
        <OrderSeatPicker venueId={venueId} tableId={draft.tableId} seat={draft.seat} onTable={draft.chooseTable} onSeat={draft.chooseSeat} />
        <Stack gap={2}>
          <Text variant="label">{t('console.fnb.orderItems')}</Text>
          <MenuSteppers menu={menu} counts={draft.counts} onChange={draft.count} />
        </Stack>
        {canComp ? <Switch label={t('console.fnb.isComp')} isOn={draft.isComp} onChange={draft.comp} /> : null}
        {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
