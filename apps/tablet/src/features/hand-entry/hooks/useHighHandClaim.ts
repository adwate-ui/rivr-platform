import { zodResolver } from '@hookform/resolvers/zod';
import { highHandClaimSchema } from '@rivr/contracts';
import { useClaimHighHand, type HighHandClaimFailure } from '@rivr/db';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

export type HighHandValues = z.output<typeof highHandClaimSchema>;

/** What happened to the last claim: sent to the floor, or not, with what to send again. */
export type ClaimNote =
  | { kind: 'sent' }
  | { kind: 'failed'; failure: HighHandClaimFailure; handId: string; values: HighHandValues };

/**
 * The high-hand claim that goes with the hand being logged (#47, design prompt flow 6): off until
 * the dealer turns it on; then the type of hand, the seat and a four of a kind's rank. `ready` checks
 * it before the hand is logged; `send` sends it once the hand has its id, and keeps a failed one to
 * send again, since the hand itself is logged.
 */
export function useHighHandClaim() {
  const claim = useClaimHighHand();
  const [isOn, setIsOn] = useState(false);
  const [note, setNote] = useState<ClaimNote | null>(null);
  const [resolver] = useState(() => zodResolver(highHandClaimSchema));
  const form = useForm<z.input<typeof highHandClaimSchema>, unknown, HighHandValues>({ resolver, defaultValues: { rank: null } });
  /** The claim to send with the hand: null with the switch off; false when it is not complete (the fields say why). */
  const ready = async (): Promise<HighHandValues | null | false> => {
    if (!isOn) return null;
    return (await form.trigger()) ? highHandClaimSchema.parse(form.getValues()) : false;
  };
  const send = async (handId: string, values: HighHandValues) => {
    const sent = await claim.mutateAsync({ handId, ...values });
    setNote(sent.ok ? { kind: 'sent' } : { kind: 'failed', failure: sent.error, handId, values });
    if (!sent.ok) return;
    setIsOn(false);
    form.reset({ rank: null });
  };
  const turn = (on: boolean) => {
    setIsOn(on);
    setNote(null);
  };
  return { form, isOn, turn, note, ready, send, isPending: claim.isPending };
}
