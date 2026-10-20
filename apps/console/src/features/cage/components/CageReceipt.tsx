import { useStaffVenue, useVenueIssuer } from '@rivr/db';
import { documents, registerMessages, t } from '@rivr/i18n';
import { Button, PrintSheet, ThermalReceipt, type ReceiptLine } from '@rivr/ui';
import { useState } from 'react';

// The receipt's own words (dated in IST, the practice notice, the reference) are the printed documents' copy.
registerMessages({ documents });

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
 * A cage transaction's thermal receipt (#69): Print receipt prints it, and only it, on the printer the cage
 * computer prints to (the owner's answer to #412). At the practice venue it says it is a practice receipt.
 */
export function CageReceipt({ venueId, title, lines, total, transactionId }: CageReceiptProps) {
  const staff = useStaffVenue();
  const issuer = useVenueIssuer(venueId);
  const [at] = useState(() => new Date().toISOString());
  if (staff.status !== 'ready' || !issuer.data) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => globalThis.print()}>{t('console.cage.printReceipt')}</Button>
      <PrintSheet>
        <ThermalReceipt issuer={issuer.data} isPractice={staff.venue.isPractice} title={title} at={at} lines={lines} total={total}
          reference={transactionId.slice(0, 8).toUpperCase()} />
      </PrintSheet>
    </>
  );
}
