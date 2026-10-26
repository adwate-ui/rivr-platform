import { zodResolver } from '@hookform/resolvers/zod';
import { repaymentSchema } from '@rivr/contracts';
import { useOpenMarkers, useRepayment, type OpenMarker, type RepaymentFailure } from '@rivr/db';
import { fromRupees, type Paise } from '@rivr/domain/money';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { REPAYMENT_FAILURE_COPY } from './creditCopy.ts';

type RepaymentForm = UseFormReturn<z.input<typeof repaymentSchema>, unknown, z.output<typeof repaymentSchema>>;

/** The members who owe on markers, each once, in the open markers' order (oldest first). */
function debtors(markers: readonly OpenMarker[]): { value: string; label: string }[] {
  const names = new Map<string, string>();
  for (const marker of markers) if (!names.has(marker.memberId)) names.set(marker.memberId, marker.fullName);
  return [...names].map(([value, label]) => ({ value, label }));
}

/** Who pays, how much, and how: cash, or UPI with its UTR. Any change is a new repayment, with a new request id. */
function RepaymentFields({ form, markers, onChange }: { form: RepaymentForm; markers: readonly OpenMarker[]; onChange: () => void }) {
  const memberId = useWatch({ control: form.control, name: 'memberId' });
  const method = useWatch({ control: form.control, name: 'method' });
  const errors = form.formState.errors;
  const fields = { amount: form.register('amount', { onChange }), utr: form.register('utr', { onChange }) };
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('console.markers.repayWho')} mode="one" options={debtors(markers)} selected={memberId === '' ? [] : [memberId]}
        onChange={(picked) => { form.setValue('memberId', picked[0] ?? ''); onChange(); }} />
      {errors.memberId ? <ErrorMessage>{t('console.markers.chooseMember')}</ErrorMessage> : null}
      <Input {...fields.amount} label={t('console.markers.repayAmount')} prefix={t('console.markers.rupee')} inputMode="numeric" autoComplete="off"
        error={errors.amount ? t('console.markers.invalidAmount') : undefined} />
      <ChoiceChips label={t('console.markers.repayMethod')} mode="one" selected={[method]}
        options={[{ value: 'cash', label: t('console.markers.cash') }, { value: 'upi', label: t('console.markers.upi') }]}
        onChange={(picked) => { form.setValue('method', picked[0] === 'upi' ? 'upi' : 'cash'); onChange(); }} />
      {method === 'upi' ? (
        <Input {...fields.utr} label={t('console.markers.utr')} inputMode="numeric" autoComplete="off"
          error={errors.utr ? t('console.markers.invalidUtr') : undefined} />
      ) : null}
    </Stack>
  );
}

/**
 * The cashier takes a repayment of a member's markers (#92): by cash, or by UPI with its UTR. The
 * database settles the oldest marker first and refuses more than the member owes.
 */
export function RepaymentForm({ venueId }: { venueId: string }) {
  const markers = useOpenMarkers(venueId);
  const repay = useRepayment(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<{ repaid: Paise | null; failure: RepaymentFailure | null }>({ repaid: null, failure: null });
  const [resolver] = useState(() => zodResolver(repaymentSchema));
  const form: RepaymentForm = useForm({ resolver, defaultValues: { memberId: '', amount: '', method: 'cash', utr: '' } });
  const submit = form.handleSubmit(async ({ memberId, amount, method, utr }) => {
    const done = await repay.mutateAsync({ memberId, amount: fromRupees(BigInt(amount)), method, utr: method === 'upi' ? utr : null, requestId });
    setOutcome(done.ok ? { repaid: done.value, failure: null } : { repaid: null, failure: done.error });
    if (!done.ok) return;
    form.reset();
    setRequestId(crypto.randomUUID());
  });
  // The open markers' loading and error show beside, in the Outstanding list that reads the same.
  if (markers.data === undefined) return null;
  const hasDebtors = markers.data.length > 0;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.markers.repay')}</Heading>
      <Text variant="small" tone="muted">{hasDebtors ? t('console.markers.repayHint') : t('console.markers.noOpen')}</Text>
      {hasDebtors ? <RepaymentFields form={form} markers={markers.data} onChange={() => setRequestId(crypto.randomUUID())} /> : null}
      {hasDebtors ? <Button isLoading={repay.isPending} onClick={() => void submit()}>{t('console.markers.repaySave')}</Button> : null}
      {outcome.failure === null ? null : <ErrorMessage>{t(REPAYMENT_FAILURE_COPY[outcome.failure])}</ErrorMessage>}
      {outcome.repaid === null ? null : <Text tone="money">{t('console.markers.repaid', { amount: formatMoney(outcome.repaid) })}</Text>}
    </Stack>
  );
}
