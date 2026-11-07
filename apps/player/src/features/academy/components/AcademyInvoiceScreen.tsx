import { useAcademyInvoice, useAuthStatus } from '@rivr/db';
import { documents, registerMessages, t } from '@rivr/i18n';
import { InvoiceDocument, Screen } from '@rivr/ui';
import { Navigate, useCanGoBack, useNavigate, useParams, useRouter } from '@tanstack/react-router';

// The invoice's words are the printed documents' copy, loaded with this screen only.
registerMessages({ documents });

/**
 * A paid booking's invoice (#249), as issued, on its own page with no app frame, so the browser's print saves
 * just the invoice as a PDF (the owner's answer to #412). Not behind the Academy feature: a member keeps the
 * invoice for what they paid whatever their tier becomes.
 */
export function AcademyInvoiceScreen() {
  const { bookingId = '' } = useParams({ strict: false });
  const authStatus = useAuthStatus();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  // Back to where it was opened from, or to /academy in its place: never a new entry on top (owner, 8 Nov).
  const toAcademy = () => (canGoBack ? router.history.back() : void navigate({ to: '/academy', replace: true }));
  const invoice = useAcademyInvoice(bookingId);
  const title = t('player.academy.invoice');
  // Outside the frame, so it sends the signed-out to sign-in itself, to come back here (as #233).
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next: `/academy/${bookingId}/invoice` }} replace />;
  if (invoice.isPending) return <Screen title={title} status="loading" />;
  if (invoice.data === undefined) return <Screen title={title} status="error" onRetry={() => void invoice.refetch()} />;
  if (invoice.data === null) return <Screen title={title} status="empty" emptyText={t('player.academy.noInvoice')} />;
  return <InvoiceDocument invoice={invoice.data} onBack={toAcademy} onSave={() => globalThis.print()} />;
}
