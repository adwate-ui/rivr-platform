import { zodResolver } from '@hookform/resolvers/zod';
import { handEntrySchema } from '@rivr/contracts';
import { useLogHand, type HandVariant, type LogHandFailure, type TableRules } from '@rivr/db';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { potTake } from '@rivr/domain/rake';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Keypad, Stack } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { logFailureText, variantOptions } from './handCopy.ts';
import { TakeSummary } from './TakeSummary.tsx';

/** A hand as sent: its pot and game, its request id, and when Log hand was first pressed for it. */
interface SentHand {
  readonly pot: string;
  readonly variant: HandVariant;
  readonly requestId: string;
  readonly playedAt: Date;
}

/**
 * The game, the pot keypad and Log hand, with the rake, drop and pull as the pot is typed. When an
 * answer is lost, the hand may have been logged: pressing Log hand again for the same pot and game
 * sends the same request with the same time, so it is logged once. Any other answer means nothing
 * was logged, and the next press is a new request.
 */
export function HandForm({ rules }: { rules: TableRules }) {
  const log = useLogHand();
  const [sent, setSent] = useState<SentHand | null>(null);
  const [failure, setFailure] = useState<LogHandFailure | null>(null);
  const [resolver] = useState(() => zodResolver(handEntrySchema));
  const form = useForm<z.input<typeof handEntrySchema>, unknown, z.output<typeof handEntrySchema>>({ resolver, defaultValues: { pot: '', variant: 'holdem' } });
  const typed = useWatch({ control: form.control, name: 'pot' });
  const pot = typed === '' ? ZERO : fromRupees(BigInt(typed));
  const submit = form.handleSubmit(async (values) => {
    const hand = sent?.pot === values.pot && sent.variant === values.variant
      ? sent : { ...values, requestId: crypto.randomUUID(), playedAt: new Date() };
    const logged = await log.mutateAsync({ pot, variant: hand.variant, playedAt: hand.playedAt, requestId: hand.requestId });
    setSent(!logged.ok && logged.error === 'unavailable' ? hand : null);
    setFailure(logged.ok ? null : logged.error);
    if (logged.ok) form.reset();
  });
  return (
    <Stack gap={4}>
      <TakeSummary pot={pot} take={potTake(pot, rules.rake)} cap={rules.rake.cap} />
      {form.formState.errors.pot ? <ErrorMessage>{t('tablet.handEntry.notChips', { amount: formatMoney(pot) })}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{logFailureText(failure)}</ErrorMessage>}
      <Controller control={form.control} name="variant" render={({ field }) => (
        // Pressing the chosen game again keeps it: a double tap never turns PLO into Hold'em.
        <ChoiceChips label={t('tablet.handEntry.variant')} mode="one" selected={[field.value]} options={variantOptions(rules.hasVariation)}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} isDisabled={log.isPending} />
      )} />
      <Controller control={form.control} name="pot" render={({ field }) => (
        <Keypad label={t('tablet.handEntry.enterPot')} value={field.value} onChange={field.onChange} isDisabled={log.isPending} />
      )} />
      <Button variant="primary" size="large" fullWidth isLoading={log.isPending} isDisabled={typed === ''} onClick={() => void submit()}>
        {t('tablet.handEntry.log')}
      </Button>
    </Stack>
  );
}
