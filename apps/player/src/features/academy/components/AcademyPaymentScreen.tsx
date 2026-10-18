import { zodResolver } from '@hookform/resolvers/zod';
import { useAcademyActions, useAcademyPayment } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Button, Input, StepScreen, Text } from '@rivr/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, type FieldError } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

const utrForm = z.object({ utr: z.string().trim().regex(/^\d{12}$/) });

/** A refusal carries its own words; anything else failed the field's check. */
function utrErrorOf(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  return error.type === 'server' ? error.message : t('player.academy.utrInvalid');
}

/** The booking once the UTR is sent, or once it is paid: where it stands, and back to the batches. */
function PaymentDone({ isSent, onDone }: { isSent: boolean; onDone: () => void }) {
  return (
    <StepScreen title={t('player.academy.payTitle')} back={{ label: t('common.back'), onBack: onDone }}
      footer={<Button variant="primary" fullWidth onClick={onDone}>{t('player.academy.done')}</Button>}>
      <Text>{t(isSent ? 'player.academy.paymentSent' : 'player.academy.paid')}</Text>
    </StepScreen>
  );
}

/**
 * Paying for a seat: the amount and the club's UPI, paid from any UPI app, then the 12-digit UTR
 * from that payment. A cashier confirms it against the bank.
 */
export function AcademyPaymentScreen() {
  const { bookingId = '' } = useParams({ strict: false });
  const payment = useAcademyPayment(bookingId);
  const { claimPayment } = useAcademyActions();
  const navigate = useNavigate();
  const [isSent, setIsSent] = useState(false);
  const [resolver] = useState(() => zodResolver(utrForm));
  const form = useForm<z.input<typeof utrForm>, unknown, z.output<typeof utrForm>>({ resolver, defaultValues: { utr: '' } });
  const toBatches = () => void navigate({ to: '/academy' });

  const send = form.handleSubmit(async ({ utr }) => {
    const sent = await claimPayment.mutateAsync({ bookingId, utr });
    if (sent.ok) setIsSent(true);
    else form.setError('utr', { type: 'server', message: t(FAILURE_COPY[sent.error]) });
  });
  if (isSent || payment.data === null) return <PaymentDone isSent={isSent} onDone={toBatches} />;
  const utrField = form.register('utr');
  return (
    <StepScreen title={t('player.academy.payTitle')} back={{ label: t('common.back'), onBack: toBatches }} onSubmit={send}
      footer={<Button variant="primary" type="submit" fullWidth isLoading={claimPayment.isPending || payment.isPending}>{t('player.academy.sendUtr')}</Button>}>
      {payment.isError ? <Text>{t('common.loadFailed')}</Text> : null}
      {payment.data ? (
        <Text>{t('player.academy.payTo', { amount: formatMoney(payment.data.amount), upi: payment.data.upiVpa ?? '' })}</Text>
      ) : null}
      <Input {...utrField} label={t('player.academy.utrLabel')} inputMode="numeric" maxLength={12} autoComplete="off"
        error={utrErrorOf(form.formState.errors.utr)} />
    </StepScreen>
  );
}
