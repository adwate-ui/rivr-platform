import { zodResolver } from '@hookform/resolvers/zod';
import { handEntrySchema } from '@rivr/contracts';
import { useLogHand, type LogHandFailure, type TableRules } from '@rivr/db';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { potTake } from '@rivr/domain/rake';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Keypad, Stack } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { logFailureText, variantOptions } from './handCopy.ts';
import { TakeSummary } from './TakeSummary.tsx';

/** One hand as sent: its request id, and when Log hand was first pressed for it. */
interface HandRequest {
  readonly requestId: string;
  readonly playedAt: Date | null;
}

const newRequest = (): HandRequest => ({ requestId: crypto.randomUUID(), playedAt: null });

/**
 * The game, the pot keypad and Log hand, with the rake, drop and pull as the pot is typed. A new
 * request for each hand: a press again after a lost answer sends the same request with the same
 * time, so the hand is logged once; another pot or game, or a hand logged, starts a new one.
 */
export function HandForm({ rules }: { rules: TableRules }) {
  const log = useLogHand();
  const [request, setRequest] = useState(newRequest);
  const [failure, setFailure] = useState<LogHandFailure | null>(null);
  const [resolver] = useState(() => zodResolver(handEntrySchema));
  const form = useForm<z.input<typeof handEntrySchema>, unknown, z.output<typeof handEntrySchema>>({ resolver, defaultValues: { pot: '', variant: 'holdem' } });
  const typed = useWatch({ control: form.control, name: 'pot' });
  const pot = typed === '' ? ZERO : fromRupees(BigInt(typed));
  const submit = form.handleSubmit(async ({ variant }) => {
    const playedAt = request.playedAt ?? new Date();
    setRequest({ ...request, playedAt });
    const logged = await log.mutateAsync({ pot, variant, playedAt, requestId: request.requestId });
    setFailure(logged.ok ? null : logged.error);
    if (logged.ok) {
      form.reset();
      setRequest(newRequest());
    }
  });
  const changed = (onChange: (value: string) => void) => (value: string) => {
    onChange(value);
    setRequest(newRequest());
  };
  return (
    <Stack gap={5}>
      <TakeSummary pot={pot} take={potTake(pot, rules.rake)} cap={rules.rake.cap} />
      <Controller control={form.control} name="variant" render={({ field }) => (
        <ChoiceChips label={t('tablet.handEntry.variant')} mode="one" selected={[field.value]} options={variantOptions(rules.hasVariation)}
          onChange={(chosen) => changed(field.onChange)(chosen[0] ?? 'holdem')} isDisabled={log.isPending} />
      )} />
      <Controller control={form.control} name="pot" render={({ field }) => (
        <Keypad label={t('tablet.handEntry.enterPot')} value={field.value} onChange={changed(field.onChange)} isDisabled={log.isPending} />
      )} />
      {form.formState.errors.pot ? <ErrorMessage>{t('tablet.handEntry.notChips', { amount: formatMoney(pot) })}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{logFailureText(failure)}</ErrorMessage>}
      <Button variant="primary" size="large" fullWidth isLoading={log.isPending} isDisabled={typed === ''} onClick={() => void submit()}>
        {t('tablet.handEntry.log')}
      </Button>
    </Stack>
  );
}
