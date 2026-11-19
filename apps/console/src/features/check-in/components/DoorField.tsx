import { useTodaysPlayers, type MemberRow, type TodaysPlayer } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, MemberLink, Stack, StatusMessage, Text, useIsWide } from '@rivr/ui';
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
    default: return null;
  }
}

/** The line read out as a check-in or check-out goes through; empty otherwise, so the next one is read too. */
function doneOf(outcome: DoorOutcome | null): string | null {
  if (outcome?.kind === 'checked_in') return t('console.checkIn.checkedIn');
  return outcome?.kind === 'checked_out' ? t('console.checkIn.checkedOut') : null;
}

/**
 * Whether a member is in the club, as the door's own table has it: seated, or with a visit open today. One who joined a
 * list from the app is waiting but not yet in, and checks in.
 */
const isInClub = (player: TodaysPlayer) => player.status === 'playing' || (player.checkedInAt !== null && player.checkedOutAt === null);

/** Each action's words: on its button, and read out with the member's name. */
const ACTION_WORDS: Readonly<Record<DoorAction, { readonly label: MessageKey; readonly named: MessageKey }>> = {
  in: { label: 'console.checkIn.checkIn', named: 'console.checkIn.checkInMember' },
  out: { label: 'console.checkIn.checkOut', named: 'console.checkIn.checkOutMember' },
};

/** The action that fits a member: Check out for one in the club, Check in for anyone else. */
const actionFor = (memberId: string, inClub: ReadonlySet<string>): DoorAction => (inClub.has(memberId) ? 'out' : 'in');

/** The members in the club now, from today's players, read only while matches show; whether that is known yet. */
function useInClub(venueId: string, isWanted: boolean): { readonly inClub: ReadonlySet<string>; readonly isKnown: boolean } {
  const today = useTodaysPlayers(venueId, isWanted);
  return { inClub: new Set((today.data ?? []).filter(isInClub).map((player) => player.memberId)), isKnown: today.data !== undefined };
}

interface MatchesProps {
  matches: readonly MemberRow[];
  inClub: ReadonlySet<string>;
  /** A check-in or check-out is under way, or who is in the club is not known yet: no row's action may be pressed. */
  isHeld: boolean;
  onChoose: (memberId: string, action: DoorAction) => void;
}

/**
 * The members matching what is typed, as it is typed (owner, 16 Nov): each with the action that fits them, Check out for one
 * in the club, Check in for anyone else.
 */
function Matches({ matches, inClub, isHeld, onChoose }: MatchesProps) {
  return (
    <Stack gap={0} divided>
      {matches.map((row) => {
        const action = actionFor(row.memberId, inClub);
        const words = ACTION_WORDS[action];
        return (
          <Inline key={row.memberId} gap={4} justify="between">
            <Stack gap={1}>
              <Text variant="row" weight="medium"><MemberLink memberId={row.memberId}>{row.fullName}</MemberLink></Text>
              <Text variant="secondary" tone="muted">{t('console.checkIn.memberMeta', { number: row.memberNumber, tier: row.tierName })}</Text>
            </Stack>
            <Button variant="subtle" size="small" aria-label={t(words.named, { name: row.fullName })} isDisabled={isHeld}
              onClick={() => onChoose(row.memberId, action)}>
              {t(words.label)}
            </Button>
          </Inline>
        );
      })}
    </Stack>
  );
}

/**
 * The door's one field (console v3): the front desk types a
 * mobile number, a member number or a name. Enter or Check in checks in a single match; Check out checks out the same
 * way. The members matching a name or number show as it is typed, each with Check in or Check out. The field keeps the
 * focus for the next member.
 */
export function DoorField({ venueId }: { venueId: string }) {
  const door = useDoorField(venueId);
  const field = useRef<HTMLInputElement>(null);
  const press = (action: DoorAction) => void door.press(action).then(() => field.current?.focus());
  const problem = problemOf(door.outcome);
  const { inClub, isKnown } = useInClub(venueId, door.matches.length > 0);
  const choose = (memberId: string, action: DoorAction) => void door.choose(memberId, action).then(() => field.current?.focus());
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
      {door.outcome?.kind === 'several' ? <Text tone="muted">{t('console.checkIn.several')}</Text> : null}
      {door.matches.length === 0 ? null : <Matches matches={door.matches} inClub={inClub} isHeld={door.isBusy || !isKnown} onChoose={choose} />}
    </Stack>
  );
}
