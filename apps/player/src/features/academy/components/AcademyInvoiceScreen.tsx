import { useAcademyInvoice } from '@rivr/db';
import { documents, registerMessages, t } from '@rivr/i18n';
import { InvoiceDocument, Screen } from '@rivr/ui';
import { useParams } from '@tanstack/react-router';

// The invoice's words are the printed documents' copy, loaded with this screen only.
registerMessages({ documents });

/**
 * A paid booking's invoice (#249), as issued, on its own page with no app frame, so the browser's print saves
 * just the invoice as a PDF (the owner's answer to #412). Not behind the Academy feature: a member keeps the
 * invoice for what they paid whatever their tier becomes.
 */
export function AcademyInvoiceScreen() {
  const { bookingId = '' } = useParams({ strict: false });
  const invoice = useAcademyInvoice(bookingId);
  const title = t('player.academy.invoice');
  if (invoice.isPending) return <Screen title={title} status="loading" />;
  if (invoice.data === undefined) return <Screen title={title} status="error" onRetry={() => void invoice.refetch()} />;
  if (invoice.data === null) return <Screen title={title} status="empty" emptyText={t('player.academy.noInvoice')} />;
  return <InvoiceDocument invoice={invoice.data} onSave={() => globalThis.print()} />;
}
