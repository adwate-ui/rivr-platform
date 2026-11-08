import { useFnbActions, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, PrintSheet, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { orderNotes } from './orderLanes.ts';

/**
 * The KOT on paper, as the bar printer prints it: its number, the table and seat, when, what, the member's note for the whole order, and comp. It names no member:
 * the paper goes to Glaza's bar, a vendor, as the bar printer's KOT does.
 */
function PrintedKot({ order }: { order: FnbOrderTonight }) {
  const note = orderNotes(order);
  return (
    <Stack gap={1}>
      <Text weight="semibold">{t('console.fnb.kot', { kot: order.kotNumber })}</Text>
      <Text>{t('console.fnb.kotWhere', { table: order.tableName, seat: order.seat })}</Text>
      <Text>{t('console.fnb.orderedAt', { time: formatTime(new Date(order.createdAt)) })}</Text>
      {order.lines.map((line) => <Text key={line.itemId}>{t('console.fnb.line', { quantity: line.quantity, name: line.name })}</Text>)}
      {note === null ? null : <Text>{t('console.fnb.note', { note })}</Text>}
      {order.isComp ? <Text>{t('console.fnb.comp')}</Text> : null}
    </Stack>
  );
}

/** Print KOT puts the KOT on the page, prints it on this computer's printer, and takes it off when the dialog closes. */
function usePrinting() {
  const [isPrinting, setIsPrinting] = useState(false);
  const print = () => {
    flushSync(() => setIsPrinting(true));
    globalThis.addEventListener('afterprint', () => setIsPrinting(false), { once: true });
    globalThis.print();
  };
  return { isPrinting, print };
}

/**
 * The bar printer did not get this KOT (console v3), as its outbox delivery says, never a clock: print it here or read it
 * to the bar, then Bar has it, which takes the flag away. Everyone who serves F&B may say so, as mark_kot_sent allows.
 */
export function KotNotAtBar({ venueId, order }: { venueId: string; order: FnbOrderTonight }) {
  const { markSent } = useFnbActions(venueId);
  const { isPrinting, print } = usePrinting();
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const markHandedOver = async () => {
    const done = await markSent.mutateAsync(order.orderId);
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={2}>
      <ErrorMessage>{t('console.fnb.notAtBar')}</ErrorMessage>
      <Inline gap={2} wrap>
        <Button variant="subtle" size="small" aria-label={t('console.fnb.printKotName', { kot: order.kotNumber })} onClick={print}>
          {t('console.fnb.printKot')}
        </Button>
        <Button variant="subtle" size="small" aria-label={t('console.fnb.barHasItName', { kot: order.kotNumber })}
          isLoading={markSent.isPending} onClick={() => void markHandedOver()}>{t('console.fnb.barHasIt')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      {isPrinting ? <PrintSheet><PrintedKot order={order} /></PrintSheet> : null}
    </Stack>
  );
}
