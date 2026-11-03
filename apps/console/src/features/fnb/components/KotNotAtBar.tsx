import { useFnbActions, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, PrintSheet, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { orderWhere } from './orderLanes.ts';

/** The KOT on paper, as the bar printer would have printed it: its number, where it goes, when, what, and comp. */
function PrintedKot({ order }: { order: FnbOrderTonight }) {
  return (
    <Stack gap={1}>
      <Text weight="semibold">{t('console.fnb.kot', { kot: order.kotNumber })}</Text>
      <Text>{orderWhere(order)}</Text>
      <Text>{t('console.fnb.orderedAt', { time: formatTime(new Date(order.createdAt)) })}</Text>
      {order.lines.map((line) => <Text key={line.itemId}>{t('console.fnb.line', { quantity: line.quantity, name: line.name })}</Text>)}
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

interface KotNotAtBarProps {
  venueId: string;
  order: FnbOrderTonight;
  /** Marking it handed over is for staff who run F&B (mark_kot_sent). */
  canMarkSent: boolean;
}

/**
 * The bar printer did not get this KOT (console v3), as its outbox delivery says, never a clock: print it here or read it
 * to the bar, then Bar has it, which takes the flag away.
 */
export function KotNotAtBar({ venueId, order, canMarkSent }: KotNotAtBarProps) {
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
        {canMarkSent ? (
          <Button variant="subtle" size="small" aria-label={t('console.fnb.barHasItName', { kot: order.kotNumber })}
            isLoading={markSent.isPending} onClick={() => void markHandedOver()}>{t('console.fnb.barHasIt')}</Button>
        ) : null}
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      {isPrinting ? <PrintSheet><PrintedKot order={order} /></PrintSheet> : null}
    </Stack>
  );
}
