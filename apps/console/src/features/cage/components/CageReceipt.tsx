import { useStaffVenue, useVenueIssuer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, PrintSheet, ThermalReceipt, type ReceiptLine } from '@rivr/ui';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Playback } from './Playback.tsx';

interface CageReceiptProps {
  venueId: string;
  /** What happened: `Buy-in`, `Cash-out`. */
  title: string;
  lines: readonly ReceiptLine[];
  total: { label: string; paise: bigint };
  /** The cage transaction: its first eight characters are the receipt's reference. */
  transactionId: string;
}

/**
 * Print receipt puts the receipt on the page, prints it and takes it off again when the printer dialog closes, so
 * the paper holds that receipt alone, however many the cage shows.
 */
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
 * A cage transaction's thermal receipt (#69): Print receipt prints it, and only it, on the printer the cage
 * computer prints to (the owner's answer to #412). At the practice venue it says it is a practice receipt. Callers
 * key it by its transaction, so each receipt is dated when its transaction happened.
 */
export function CageReceipt({ venueId, title, lines, total, transactionId }: CageReceiptProps) {
  const staff = useStaffVenue();
  const issuer = useVenueIssuer(venueId);
  const [at] = useState(() => new Date().toISOString());
  const { isPrinting, print } = usePrinting();
  if (issuer.isError || issuer.data === null) return <ErrorMessage>{t('console.cage.receiptUnavailable')}</ErrorMessage>;
  if (staff.status !== 'ready' || issuer.data === undefined) return null;
  return (
    <>
      <Button variant="secondary" onClick={print}>{t('console.cage.printReceipt')}</Button>
      <Playback kind="cage_transaction" id={transactionId} />
      {isPrinting ? (
        <PrintSheet>
          <ThermalReceipt issuer={issuer.data} isPractice={staff.venue.isPractice} title={title} at={at} lines={lines} total={total}
            reference={transactionId.slice(0, 8).toUpperCase()} />
        </PrintSheet>
      ) : null}
    </>
  );
}
