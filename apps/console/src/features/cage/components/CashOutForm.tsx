import { zodResolver } from '@hookform/resolvers/zod';
import { CASH_OUT_TO, cashOutSchema } from '@rivr/contracts';
import { useCageActions, type CageFailure, type CageMember, type CashOutDone } from '@rivr/db';
import { cashOut } from '@rivr/domain/cage';
import { fromRupees, isPositive, ZERO } from '@rivr/domain/money';
import { formatMoney, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { CAGE_FAILURE_COPY } from './cageCopy.ts';

type CashOutTo = (typeof CASH_OUT_TO)[number];

const TO_LABEL: Readonly<Record<CashOutTo, MessageKey>> = { cash: 'console.cage.toCash', wallet: 'console.cage.toWallet' };

/** What the cashier does once a cash-out goes through: hand over cash, see it reach the wallet, or nothing. */
function doneLine(done: CashOutDone, to: CashOutTo): string {
  if (!isPositive(done.toMember)) return t('console.cage.cashedOutAllSettled');
  const amount = formatMoney(done.toMember);
  return to === 'wallet' ? t('console.cage.cashedOutWallet', { amount }) : t('console.cage.cashedOutCash', { amount });
}

/** Why a cash-out was refused; a reused request id is told apart from the buy-in's. */
function failureCopy(failure: CageFailure): MessageKey {
  return failure === 'invalid' ? 'console.cage.cashOutInvalid' : CAGE_FAILURE_COPY[failure];
}

function CashOutDoneLines({ done, to }: { done: CashOutDone; to: CashOutTo }) {
  return (
    <Stack gap={1}>
      <Text>{doneLine(done, to)}</Text>
      {isPositive(done.settled) ? <Text tone="muted">{t('console.cage.cashedOutSettled', { amount: formatMoney(done.settled) })}</Text> : null}
    </Stack>
  );
}

/**
 * A cash-out (#75; design prompt flow 8): the chips handed back first settle the member's open markers,
 * then the rest goes to them in cash or to their wallet. @rivr/domain cashOut shows the split as it is
 * typed; the database settles the markers oldest first and says what to hand over. Once per request id.
 */
export function CashOutForm({ venueId, member }: { venueId: string; member: CageMember }) {
  const { cashOut: take } = useCageActions(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<{ failure: CageFailure | null; done: { result: CashOutDone; to: CashOutTo } | null }>({ failure: null, done: null });
  const [resolver] = useState(() => zodResolver(cashOutSchema));
  const form = useForm<z.input<typeof cashOutSchema>, unknown, z.output<typeof cashOutSchema>>({ resolver, defaultValues: { amount: '', to: 'cash' } });
  const [typed, to] = useWatch({ control: form.control, name: ['amount', 'to'] });
  const chips = /^[1-9]\d{0,7}$/.test(typed.trim()) ? fromRupees(BigInt(typed.trim())) : ZERO;
  const split = cashOut(chips, isPositive(member.markers) ? [member.markers] : []);
  const submit = form.handleSubmit(async (values) => {
    const done = await take.mutateAsync({ memberId: member.memberId, amount: fromRupees(BigInt(values.amount)), to: values.to, requestId });
    setOutcome(done.ok ? { failure: null, done: { result: done.value, to: values.to } } : { failure: done.error, done: null });
    if (done.ok) { form.reset({ amount: '', to: values.to }); setRequestId(crypto.randomUUID()); }
  });
  const amount = form.register('amount', { onChange: () => setRequestId(crypto.randomUUID()) });
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.cage.cashOutTitle')}</Heading>
      <Controller control={form.control} name="to" render={({ field }) => (
        <ChoiceChips label={t('console.cage.payTo')} mode="one" selected={[field.value]}
          options={CASH_OUT_TO.map((value) => ({ value, label: t(TO_LABEL[value]) }))} onChange={([value]) => { if (value !== undefined) field.onChange(value); }} />
      )} />
      <Input {...amount} label={t('console.cage.cashOutAmount')} prefix={t('console.cage.rupee')} inputMode="numeric" autoComplete="off"
        error={form.formState.errors.amount ? t('console.cage.invalidAmount') : undefined} />
      {split.ok ? (
        <Stack gap={2} divided>
          {split.value.settled.length === 0 ? null : (
            <Inline justify="between"><Text>{t('console.cage.settlesMarkers')}</Text><Money paise={split.value.settled[0] ?? ZERO} /></Inline>
          )}
          <Inline justify="between"><Text>{to === 'wallet' ? t('console.cage.toTheWallet') : t('console.cage.inCash')}</Text><Money paise={split.value.toMember} /></Inline>
        </Stack>
      ) : null}
      <Button variant="secondary" isDisabled={typed.trim() === ''} isLoading={take.isPending} onClick={() => void submit()}>{t('console.cage.cashOut')}</Button>
      {outcome.failure === null ? null : <ErrorMessage>{t(failureCopy(outcome.failure), { amount: formatMoney(chips) })}</ErrorMessage>}
      {outcome.done === null ? null : <CashOutDoneLines done={outcome.done.result} to={outcome.done.to} />}
    </Stack>
  );
}
