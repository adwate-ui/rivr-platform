import { zodResolver } from '@hookform/resolvers/zod';
import { handEntrySchema } from '@rivr/contracts';
import { useHandQueue } from '@rivr/db';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import type { useHighHandClaim } from './useHighHandClaim.ts';

/**
 * The pot and game being entered, and Log hand. The tablet confirms a hand at once: its queue keeps
 * it and sends it, now or once the connection is back, oldest first and once each (#43), so hands
 * keep logging offline. A high-hand claim turned on goes with its hand; one not complete stops the
 * hand being logged until it is.
 */
export function useHandEntryForm(highHand: ReturnType<typeof useHighHandClaim>) {
  const queue = useHandQueue();
  const [resolver] = useState(() => zodResolver(handEntrySchema));
  const form = useForm<z.input<typeof handEntrySchema>, unknown, z.output<typeof handEntrySchema>>({ resolver, defaultValues: { pot: '', variant: 'holdem' } });
  const typed = useWatch({ control: form.control, name: 'pot' });
  const pot = typed === '' ? ZERO : fromRupees(BigInt(typed));
  const submit = async () => {
    const claim = await highHand.ready();
    if (claim === false) return;
    await form.handleSubmit(async (values) => {
      // The key is made once, when Log hand is tapped: a replay of this hand lands once.
      await queue.log({ pot, variant: values.variant, playedAt: new Date().toISOString(), claim }, crypto.randomUUID());
      form.reset();
      if (claim !== null) highHand.queued();
    })();
  };
  return { form, typed, pot, submit };
}
