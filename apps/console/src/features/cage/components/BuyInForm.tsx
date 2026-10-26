import { zodResolver } from '@hookform/resolvers/zod';
import { BUY_IN_METHODS, cageBuyInSchema } from '@rivr/contracts';
import type { Result } from '@rivr/contracts/result';
import { useCageActions, type CageFailure, type CageMember } from '@rivr/db';
import { buyIn } from '@rivr/domain/cage';
import { fromRupees, ZERO, type Paise } from '@rivr/domain/money';
import { formatDayTime, formatMoney, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { BuyInPreview } from './BuyInPreview.tsx';
import { CageReceipt } from './CageReceipt.tsx';
import { kycBlockOf } from './cageCopy.ts';

const METHOD_LABEL: Readonly<Record<(typeof BUY_IN_METHODS)[number], MessageKey>> = {
  cash: 'console.cage.cash', upi: 'console.cage.upi', wallet: 'console.cage.fromWallet', bonus: 'console.cage.fromBonus',
};
const WHOLE_RUPEES = /^[1-9]\d{0,7}$/;

type Issued = { amount: Paise; method: (typeof BUY_IN_METHODS)[number]; transactionId: string };
type Attempt = { readonly requestId: string; readonly amount: Paise; readonly utr: string | null; readonly mayHaveGoneThrough: boolean };

// Answers that do not show the request id unused: a replay that differs ('invalid', the only 22023 this form can
// meet), a refusal before the cage looks it up ('not_allowed'), and no answer ('unavailable').
const MAY_HOLD_A_BUY_IN: ReadonlySet<CageFailure> = new Set<CageFailure>(['invalid', 'not_allowed', 'unavailable']);

/**
 * Sends each try of a buy-in under its request id. Once a try may have gone through (it is still waiting, or its answer
 * does not show the id unused), every try keeps that id, whatever was edited and whatever the cage refuses next, until
 * one succeeds: the cage gives that buy-in back, or refuses a changed one (22023), and never issues chips twice. A
 * refusal of a try under a fresh id wrote nothing, so the next keeps the id for the same amount and UTR and takes a new
 * one for another (another bank transfer is another buy-in). A ref, not state, so a second tap before the next render
 * already sees the first.
 */
function useBuyInTries() {
  const last = useRef<Attempt | null>(null);
  return async (amount: Paise, utr: string | null, issue: (requestId: string) => Promise<Result<string, CageFailure>>) => {
    const previous = last.current;
    const isSameTry = previous !== null && (previous.mayHaveGoneThrough || (previous.amount === amount && previous.utr === utr));
    const isUncertain = isSameTry && previous.mayHaveGoneThrough;
    const attempt: Attempt = { requestId: isSameTry ? previous.requestId : crypto.randomUUID(), amount, utr, mayHaveGoneThrough: true };
    last.current = attempt;
    const done = await issue(attempt.requestId);
    if (done.ok) last.current = null;
    else if (last.current === attempt) last.current = { ...attempt, mayHaveGoneThrough: isUncertain || MAY_HOLD_A_BUY_IN.has(done.error) };
    return done;
  };
}

/** Why the cage cannot issue chips to this member at all, as the prototype says it; null when it can. */
function blockOf(member: CageMember): string | null {
  if (!member.isKycComplete) return kycBlockOf(member);
  if (member.breakUntil !== null) return t('console.cage.breakBlock', { until: formatDayTime(new Date(member.breakUntil)) });
  return member.seat === null ? t('console.cage.notSeatedBlock') : null;
}

/**
 * The buy-in: cash, UPI with its UTR, from the wallet or from the bonus (#17), and the amount; @rivr/domain
 * buyIn says at once why not (not whole chips, below the table's minimum, more than the wallet or bonus), the database
 * checks it again; Issue chips, once per request id: a retried tap is the same buy-in, another amount or UTR another one.
 */
export function BuyInForm({ venueId, member }: { venueId: string; member: CageMember }) {
  const { buyIn: issue } = useCageActions(venueId);
  const [outcome, setOutcome] = useState<{ failure: CageFailure | null; issued: Issued | null }>({ failure: null, issued: null });
  const tryBuyIn = useBuyInTries();
  const [resolver] = useState(() => zodResolver(cageBuyInSchema));
  const form = useForm<z.input<typeof cageBuyInSchema>, unknown, z.output<typeof cageBuyInSchema>>({ resolver, defaultValues: { amount: '', method: 'cash', utr: '' } });
  const [typed, method] = useWatch({ control: form.control, name: ['amount', 'method'] });
  const amount = WHOLE_RUPEES.test(typed.trim()) ? fromRupees(BigInt(typed.trim())) : ZERO;
  const block = blockOf(member);
  const submit = form.handleSubmit(async (values) => {
    const rule = buyIn(values.method, amount, member.seat?.minimum ?? ZERO, { wallet: member.wallet, bonus: member.bonus });
    if (!rule.ok) return setOutcome({ failure: rule.error, issued: null });
    const utr = values.method === 'upi' ? values.utr : null;
    const done = await tryBuyIn(amount, utr, (requestId) => issue.mutateAsync({ memberId: member.memberId, amount, method: values.method, utr, requestId, buyInRequestId: null }));
    setOutcome(done.ok ? { failure: null, issued: { amount, method: values.method, transactionId: done.value } } : { failure: done.error, issued: null });
    if (done.ok) form.reset({ amount: '', method: values.method, utr: '' });
  });
  const fields = { amount: form.register('amount'), utr: form.register('utr') };
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
      <BuyInPreview member={member} amount={amount} method={method} failure={outcome.failure} issued={outcome.issued ? formatMoney(outcome.issued.amount) : null} />
      {outcome.issued === null ? null : (
        <CageReceipt key={outcome.issued.transactionId} venueId={venueId} title={t('console.cage.receiptBuyIn')} transactionId={outcome.issued.transactionId}
          lines={[{ label: t('console.cage.receiptMember'), value: member.fullName }, { label: t('console.cage.method'), value: t(METHOD_LABEL[outcome.issued.method]) }]}
          total={{ label: t('console.cage.receiptChipsIssued'), paise: outcome.issued.amount }} />
      )}
      <Button variant="primary" isDisabled={block !== null || typed === ''} isLoading={issue.isPending} onClick={() => void submit()}>{t('console.cage.issueChips')}</Button>
    </Stack>
  );
}
