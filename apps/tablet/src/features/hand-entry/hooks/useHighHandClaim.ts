import { zodResolver } from '@hookform/resolvers/zod';
import { highHandClaimSchema } from '@rivr/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

export type HighHandValues = z.output<typeof highHandClaimSchema>;

/**
 * The high-hand claim that goes with the hand being logged (#47, design prompt flow 6): off until
 * the dealer turns it on; then the type of hand, the seat and a four of a kind's rank. `ready`
 * checks it before the hand is logged; the claim then travels with the hand through the tablet's
 * queue (#43), and `queued` says so and starts the next hand without one.
 */
export function useHighHandClaim() {
  const [isOn, setIsOn] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [resolver] = useState(() => zodResolver(highHandClaimSchema));
  const form = useForm<z.input<typeof highHandClaimSchema>, unknown, HighHandValues>({ resolver, defaultValues: { rank: null } });
  /** The claim to send with the hand: null with the switch off; false when it is not complete (the fields say why). */
  const ready = async (): Promise<HighHandValues | null | false> => {
    if (!isOn) return null;
    return (await form.trigger()) ? highHandClaimSchema.parse(form.getValues()) : false;
  };
  const queued = () => {
    setIsSent(true);
    setIsOn(false);
    form.reset({ rank: null });
  };
  const turn = (on: boolean) => {
    setIsOn(on);
    setIsSent(false);
  };
  return { form, isOn, turn, isSent, ready, queued };
}
