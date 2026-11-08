import type { MemberRow } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, StatusMessage, Text, useIsWide } from '@rivr/ui';
import { useRef } from 'react';
import { CHECK_IN_FAILURE_COPY, checkOutRefusalText } from './checkInCopy.ts';
import { useDoorField, type DoorAction, type DoorOutcome } from './useDoorField.ts';

/** What went wrong, in words; null for an outcome that went through or lists matches. */
function problemOf(outcome: DoorOutcome | null): string | null {
  switch (outcome?.kind) {
    case 'in_failed': return t(CHECK_IN_FAILURE_COPY[outcome.failure]);
    case 'out_failed': return checkOutRefusalText(outcome.refusal);
    case 'unusable': return t('console.checkIn.unusable');
    case 'no_match': return t('console.checkIn.noMatch');
    case 'card_out': return t('console.checkIn.cardCheckOut');
    default: return null;
  }
}

/** The line read out as a check-in or check-out goes through; empty otherwise, so the next one is read too. */
function doneOf(outcome: DoorOutcome | null): string | null {
  if (outcome?.kind === 'checked_in') return t('console.checkIn.checkedIn');
  return outcome?.kind === 'checked_out' ? t('console.checkIn.checkedOut') : null;
}

interface MatchesProps {
  matches: readonly MemberRow[];
  action: DoorAction;
  onChoose: (memberId: string) => void;
}

/** The members a name or number found, when it found more than one: each with its own Check in, or Check out. */
function Matches({ matches, action, onChoose }: MatchesProps) {
  const label = t(action === 'in' ? 'console.checkIn.checkIn' : 'console.checkIn.checkOut');
  const named = action === 'in' ? 'console.checkIn.checkInMember' : 'console.checkIn.checkOutMember';
  return (
    <Stack gap={2}>
      <Text tone="muted">{t('console.checkIn.several')}</Text>
      <Stack gap={0} divided>
        {matches.map((row) => (
          <Inline key={row.memberId} gap={4} justify="between">
            <Stack gap={1}>
              <Text variant="row" weight="medium">{row.fullName}</Text>
              <Text variant="secondary" tone="muted">{t('console.checkIn.memberMeta', { number: row.memberNumber, tier: row.tierName })}</Text>
            </Stack>
            <Button variant="subtle" size="small" aria-label={t(named, { name: row.fullName })} onClick={() => onChoose(row.memberId)}>{label}</Button>
          </Inline>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * The door's one field (console v3): the scanner types a membership card's code into it, or the front desk types a
 * mobile number, a member number or a name. Enter or Check in checks in a single match; Check out checks out the same
 * way. The field keeps the focus, so the next scan lands in it.
 */
export function DoorField({ venueId }: { venueId: string }) {
  const door = useDoorField(venueId);
  const field = useRef<HTMLInputElement>(null);
  const press = (action: DoorAction) => void door.press(action).then(() => field.current?.focus());
  const problem = problemOf(door.outcome);
  const several = door.outcome?.kind === 'several' ? door.outcome : null;
  // Check out is the field's second action: beside Check in from 768 px, under the field on a phone, so the field keeps its width.
  const isWide = useIsWide('medium');
  const checkOut = <Button variant="text" size="compact" onClick={() => press('out')}>{t('console.checkIn.checkOut')}</Button>;
  return (
    <Stack gap={3}>
      {/* The console's filled field beside its button (console v3), its name above it, the two level at their foot. */}
      <Inline gap={3} align="end">
        <Input ref={field} variant="subtle" label={t('console.checkIn.field')} value={door.text} autoComplete="off" autoFocus
          onChange={(event) => door.type(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') press('in'); }} />
        <Button variant="primary" size="compact" isLoading={door.isBusy} onClick={() => press('in')}>{t('console.checkIn.checkIn')}</Button>
        {isWide ? checkOut : null}
      </Inline>
      {isWide ? null : <Inline>{checkOut}</Inline>}
      <StatusMessage>{doneOf(door.outcome)}</StatusMessage>
      {problem === null ? null : <ErrorMessage>{problem}</ErrorMessage>}
      {several === null ? null : (
        <Matches matches={several.matches} action={several.action} onChoose={(memberId) => void door.choose(memberId, several.action)} />
      )}
    </Stack>
  );
}
