import { useUseBonus, type UseBonusFailure } from '@rivr/db/bonus';
import { formatNumber, t } from '@rivr/i18n';
import { ConfirmButton, ErrorMessage, Heading, Input, Stack, StatusMessage } from '@rivr/ui';
import { useState, type ChangeEvent } from 'react';
import { chipsFrom } from './GiveBonusChips.tsx';

type Outcome = { readonly used: number } | { readonly failure: UseBonusFailure } | null;

/** Refusals about the amount, said under its field. */
const CHIPS_FAILURES: readonly UseBonusFailure[] = ['invalid_chips', 'bonus_short', 'visit_cap'];

/** Where a refusal is said: under the amount, under the reason, or under the button for anything else. */
function placeOf(failure: UseBonusFailure): 'chips' | 'reason' | 'form' {
  if (CHIPS_FAILURES.includes(failure)) return 'chips';
  return failure === 'invalid_reason' ? 'reason' : 'form';
}

/** The last refusal's words if it belongs at `place`; none otherwise. */
function failureAt(outcome: Outcome, place: 'chips' | 'reason' | 'form'): string | undefined {
  if (outcome === null || !('failure' in outcome) || placeOf(outcome.failure) !== place) return undefined;
  return t(`console.members.bonus.use.failures.${outcome.failure}`);
}

/**
 * Bonus used without a seat (the owner, 20 Nov), for super admins, admins, floor managers and cashiers: on the member's record beside
 * Add Bonus, and in a sheet from their row at the Door. How many, in whole fifties, and why, asked twice. The database takes
 * it checked in or not (the owner, 22 Nov), within what they hold and the visit's limit; a refusal is said under the field it
 * is about. One request id until it goes through, is refused or what is typed changes, so pressing again never uses twice.
 */
export function UseBonus({ venueId, memberId }: { venueId: string; memberId: string }) {
  const use = useUseBonus(venueId, memberId);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<Outcome>(null);
  const chips = chipsFrom(typed);
  // What is typed anew is a use of its own, and the last refusal no longer stands.
  const edit = (set: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    set(event.target.value);
    setRequestId(crypto.randomUUID());
    setOutcome(null);
  };
  const submit = async () => {
    if (chips === null) return;
    const done = await use.mutateAsync({ chips, reason: reason.trim(), requestId });
    setOutcome(done.ok ? { used: chips } : { failure: done.error });
    if (done.ok || done.error !== 'unavailable') setRequestId(crypto.randomUUID());
    if (done.ok) { setTyped(''); setReason(''); }
  };
  const formFailure = failureAt(outcome, 'form');
  return (
    <Stack as="section" aria-label={t('console.members.bonus.use.title')} gap={3}>
      <Heading level={3}>{t('console.members.bonus.use.title')}</Heading>
      <Input label={t('console.members.bonus.use.chips')} hint={t('console.members.bonus.use.chipsHint')} error={failureAt(outcome, 'chips')} value={typed}
        inputMode="numeric" autoComplete="off" onChange={edit(setTyped)} />
      <Input label={t('console.members.bonus.use.reason')} hint={t('console.members.bonus.use.reasonHint')} error={failureAt(outcome, 'reason')} value={reason}
        maxLength={200} autoComplete="off" onChange={edit(setReason)} />
      <Stack align="start">
        <ConfirmButton variant="subtle" label={t('console.members.bonus.use.use')} isBusy={use.isPending}
          confirm={t('console.members.bonus.use.confirm', { chips: formatNumber(chips ?? 0) })}
          isDisabled={chips === null || reason.trim().length < 3} onConfirm={() => void submit()} />
      </Stack>
      <StatusMessage>{outcome !== null && 'used' in outcome ? t('console.members.bonus.use.used', { chips: formatNumber(outcome.used) }) : null}</StatusMessage>
      {formFailure === undefined ? null : <ErrorMessage>{formFailure}</ErrorMessage>}
    </Stack>
  );
}
