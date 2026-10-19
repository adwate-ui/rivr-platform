import { zodResolver } from '@hookform/resolvers/zod';
import { creditLimitSchema } from '@rivr/contracts';
import { useCreditActions, type CreditFailure } from '@rivr/db';
import { creditLimit, type CreditLimitState } from '@rivr/domain/credit';
import { fromRupees, type Paise } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CREDIT_FAILURE_COPY } from './creditCopy.ts';

/**
 * Sets a member's credit limit by mobile number (#73): @rivr/domain creditLimit says at once when it
 * is not whole chips; the database checks KYC, the visits and the threshold, and says whether the
 * limit is in force or waits for a super admin.
 */
export function SetLimitForm({ venueId, threshold }: { venueId: string; threshold: Paise }) {
  const { setLimit } = useCreditActions(venueId);
  const [outcome, setOutcome] = useState<{ state: CreditLimitState | null; failure: CreditFailure | null }>({ state: null, failure: null });
  const [resolver] = useState(() => zodResolver(creditLimitSchema));
  const form = useForm<z.input<typeof creditLimitSchema>, unknown, z.output<typeof creditLimitSchema>>({ resolver, defaultValues: { phone: '', limit: '', reason: '' } });
  const submit = form.handleSubmit(async ({ phone, limit, reason }) => {
    const amount = fromRupees(BigInt(limit));
    // Whole chips are checked here; whether it waits for approval, the database says (it knows the limit in force).
    const rule = creditLimit(amount, threshold, amount);
    if (!rule.ok) return setOutcome({ state: null, failure: rule.error });
    const done = await setLimit.mutateAsync({ phone, limit: amount, reason });
    setOutcome(done.ok ? { state: done.value, failure: null } : { state: null, failure: done.error });
    if (done.ok) form.reset();
  });
  const errors = form.formState.errors;
  const fields = { phone: form.register('phone'), limit: form.register('limit'), reason: form.register('reason') };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.markers.setLimit')}</Heading>
      <Inline gap={4} align="start" wrap>
        <Input {...fields.phone} type="tel" label={t('console.markers.phone')} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off"
          error={errors.phone ? t('console.markers.invalidPhone') : undefined} />
        <Input {...fields.limit} label={t('console.markers.limit')} prefix={t('console.markers.rupee')} inputMode="numeric" autoComplete="off"
          error={errors.limit ? t('console.markers.invalidLimit') : undefined} />
        <Input {...fields.reason} label={t('console.markers.reason')} autoComplete="off" error={errors.reason ? t('console.markers.invalidReason') : undefined} />
      </Inline>
      <Button variant="primary" isLoading={setLimit.isPending} onClick={() => void submit()}>{t('console.markers.save')}</Button>
      {outcome.failure === null ? null : <ErrorMessage>{t(CREDIT_FAILURE_COPY[outcome.failure])}</ErrorMessage>}
      {outcome.state === null ? null : <Text>{outcome.state === 'active' ? t('console.markers.active') : t('console.markers.needsApproval')}</Text>}
    </Stack>
  );
}
