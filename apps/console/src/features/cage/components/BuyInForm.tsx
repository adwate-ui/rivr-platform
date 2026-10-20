import { zodResolver } from '@hookform/resolvers/zod';
import { BUY_IN_METHODS, cageBuyInSchema } from '@rivr/contracts';
import { useCageActions, type CageFailure, type CageMember } from '@rivr/db';
import { buyIn } from '@rivr/domain/cage';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { formatDayTime, formatMoney, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { BuyInPreview } from './BuyInPreview.tsx';

const METHOD_LABEL: Readonly<Record<(typeof BUY_IN_METHODS)[number], MessageKey>> = {
  cash: 'console.cage.cash', upi: 'console.cage.upi', wallet: 'console.cage.fromWallet', bonus: 'console.cage.fromBonus',
};
const WHOLE_RUPEES = /^[1-9]\d{0,7}$/;

/** Why the cage cannot issue chips to this member at all, as the prototype says it; null when it can. */
function blockOf(member: CageMember): string | null {
  if (!member.isKycComplete) return t('console.cage.kycBlock');
  if (member.breakUntil !== null) return t('console.cage.breakBlock', { until: formatDayTime(new Date(member.breakUntil)) });
  return member.seat === null ? t('console.cage.notSeatedBlock') : null;
}

/**
 * The buy-in: cash, UPI with its UTR, from the wallet or from the bonus (#17), and the amount; @rivr/domain
 * buyIn says at once why not (not whole chips, below the table's minimum, more than the wallet or bonus), the database
 * checks it again; Issue chips, once per request id.
 */
export function BuyInForm({ venueId, member }: { venueId: string; member: CageMember }) {
  const { buyIn: issue } = useCageActions(venueId);
  const [outcome, setOutcome] = useState<{ failure: CageFailure | null; issued: string | null }>({ failure: null, issued: null });
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(cageBuyInSchema));
  const form = useForm<z.input<typeof cageBuyInSchema>, unknown, z.output<typeof cageBuyInSchema>>({ resolver, defaultValues: { amount: '', method: 'cash', utr: '' } });
  const [typed, method] = useWatch({ control: form.control, name: ['amount', 'method'] });
  const amount = WHOLE_RUPEES.test(typed.trim()) ? fromRupees(BigInt(typed.trim())) : ZERO;
  const block = blockOf(member);
  const submit = form.handleSubmit(async (values) => {
    const rule = buyIn(values.method, amount, member.seat?.minimum ?? ZERO, { wallet: member.wallet, bonus: member.bonus });
    if (!rule.ok) return setOutcome({ failure: rule.error, issued: null });
    const done = await issue.mutateAsync({ memberId: member.memberId, amount, method: values.method, utr: values.method === 'upi' ? values.utr : null, requestId, buyInRequestId: null });
    setOutcome(done.ok ? { failure: null, issued: formatMoney(amount) } : { failure: done.error, issued: null });
    if (done.ok) { form.reset({ amount: '', method: values.method, utr: '' }); setRequestId(crypto.randomUUID()); }
  });
  const fields = { amount: form.register('amount', { onChange: () => setRequestId(crypto.randomUUID()) }), utr: form.register('utr') };
  return (
    <Stack gap={4}>
      {block === null ? null : <ErrorMessage>{block}</ErrorMessage>}
      <Controller control={form.control} name="method" render={({ field }) => (
        <ChoiceChips label={t('console.cage.method')} mode="one" selected={[field.value]}
          options={BUY_IN_METHODS.map((value) => ({ value, label: t(METHOD_LABEL[value]) }))} onChange={([value]) => { if (value !== undefined) field.onChange(value); }} />
      )} />
      <Inline gap={4} align="start" wrap>
        <Input {...fields.amount} label={t('console.cage.amount')} prefix={t('console.cage.rupee')} inputMode="numeric" autoComplete="off"
          error={form.formState.errors.amount ? t('console.cage.invalidAmount') : undefined} />
        {method === 'upi' ? <Input {...fields.utr} label={t('console.cage.utr')} inputMode="numeric" autoComplete="off" error={form.formState.errors.utr ? t('console.cage.invalidUtr') : undefined} /> : null}
      </Inline>
      <BuyInPreview member={member} amount={amount} method={method} failure={outcome.failure} issued={outcome.issued} />
      <Button variant="primary" isDisabled={block !== null || typed === ''} isLoading={issue.isPending} onClick={() => void submit()}>{t('console.cage.issueChips')}</Button>
    </Stack>
  );
}
