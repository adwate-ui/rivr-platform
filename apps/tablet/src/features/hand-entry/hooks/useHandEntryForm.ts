import { zodResolver } from '@hookform/resolvers/zod';
import { handEntrySchema } from '@rivr/contracts';
import { useLogHand, type HandVariant, type LogHandFailure } from '@rivr/db';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import type { useHighHandClaim } from './useHighHandClaim.ts';

/** A hand as sent: its pot and game, its request id, and when Log hand was first pressed for it. */
interface SentHand {
  readonly pot: string;
  readonly variant: HandVariant;
  readonly requestId: string;
  readonly playedAt: Date;
}

/**
 * The pot and game being entered, and Log hand. When an answer is lost, the hand may have been
 * logged: pressing Log hand again for the same pot and game sends the same request with the same
 * time, so it is logged once. Any other answer means nothing was logged, and the next press is a
 * new request. A high-hand claim turned on goes to the floor once the hand is logged; one not
 * complete stops the hand being logged until it is.
 */
export function useHandEntryForm(highHand: ReturnType<typeof useHighHandClaim>) {
  const log = useLogHand();
  const [sent, setSent] = useState<SentHand | null>(null);
  const [failure, setFailure] = useState<LogHandFailure | null>(null);
  const [resolver] = useState(() => zodResolver(handEntrySchema));
  const form = useForm<z.input<typeof handEntrySchema>, unknown, z.output<typeof handEntrySchema>>({ resolver, defaultValues: { pot: '', variant: 'holdem' } });
  const typed = useWatch({ control: form.control, name: 'pot' });
  const pot = typed === '' ? ZERO : fromRupees(BigInt(typed));
  const submit = async () => {
    const claim = await highHand.ready();
    if (claim === false) return;
    await form.handleSubmit(async (values) => {
      const hand = sent?.pot === values.pot && sent.variant === values.variant
        ? sent : { ...values, requestId: crypto.randomUUID(), playedAt: new Date() };
      const logged = await log.mutateAsync({ pot, variant: hand.variant, playedAt: hand.playedAt, requestId: hand.requestId });
      setSent(!logged.ok && logged.error === 'unavailable' ? hand : null);
      setFailure(logged.ok ? null : logged.error);
      if (!logged.ok) return;
      form.reset();
      if (claim !== null) await highHand.send(logged.value, claim);
    })();
  };
  return { form, typed, pot, submit, failure, isPending: log.isPending || highHand.isPending };
}
