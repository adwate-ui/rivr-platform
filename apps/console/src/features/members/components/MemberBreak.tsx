import { useMemberActions, type MemberFailure } from '@rivr/db';
import { formatDateTime, t, type MessageKey } from '@rivr/i18n';
import { ChoiceChips, ConfirmButton, ErrorMessage, Heading, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

/** The lengths the floor chooses from, in days: a day to ten years, as the database takes (decision 0053). */
const LENGTHS = [1, 7, 30, 90, 365, 3650] as const;
type Length = (typeof LENGTHS)[number];

const LENGTH_COPY: Readonly<Record<Length, MessageKey>> = {
  1: 'console.members.break.lengths.day',
  7: 'console.members.break.lengths.week',
  30: 'console.members.break.lengths.month',
  90: 'console.members.break.lengths.quarter',
  365: 'console.members.break.lengths.year',
  3650: 'console.members.break.lengths.tenYears',
};

const FAILURE_COPY: Readonly<Record<MemberFailure, MessageKey>> = {
  not_allowed: 'console.members.break.failures.not_allowed',
  no_member: 'console.members.break.failures.no_member',
  invalid: 'console.members.break.failures.invalid',
  paused: 'console.members.break.failures.paused',
  unavailable: 'console.members.break.failures.unavailable',
};

type Outcome = { readonly until: string } | { readonly failure: MemberFailure } | null;

const lengthOf = (value: string | undefined) => LENGTHS.find((days) => String(days) === value) ?? null;

function BreakOutcome({ outcome }: { outcome: Outcome }) {
  return (
    <>
      <StatusMessage>{outcome !== null && 'until' in outcome ? t('console.members.break.started', { until: formatDateTime(new Date(outcome.until)) }) : null}</StatusMessage>
      {outcome !== null && 'failure' in outcome ? <ErrorMessage>{t(FAILURE_COPY[outcome.failure])}</ErrorMessage> : null}
    </>
  );
}

/**
 * The floor's break for a member (A5-14, decision 0053), for staff with members.manage: how long and why, asked twice, as
 * a break is never shortened. The member is off every waitlist until it ends.
 */
export function MemberBreak({ venueId, memberId }: { venueId: string; memberId: string }) {
  const { setBreak } = useMemberActions(venueId);
  const [days, setDays] = useState<Length | null>(null);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const submit = async () => {
    if (days === null) return;
    try {
      const done = await setBreak.mutateAsync({ memberId, days, reason: reason.trim() });
      setOutcome(done.ok ? { until: done.value } : { failure: done.error });
      if (done.ok) { setDays(null); setReason(''); }
    } catch {
      setOutcome({ failure: 'unavailable' });
    }
  };
  const options = LENGTHS.map((length) => ({ value: String(length), label: t(LENGTH_COPY[length]) }));
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.break.title')}</Heading>
      <Text tone="muted">{t('console.members.break.intro')}</Text>
      <ChoiceChips label={t('console.members.break.length')} mode="one" options={options} selected={days === null ? [] : [String(days)]}
        onChange={([chosen]) => setDays(lengthOf(chosen))} />
      <Input label={t('console.members.break.reason')} hint={t('console.members.break.reasonHint')} value={reason} maxLength={300} autoComplete="off"
        onChange={(event) => setReason(event.target.value)} />
      <Stack align="start">
        <ConfirmButton variant="secondary" label={t('console.members.break.start')}
          confirm={days === null ? t('console.members.break.start') : t('console.members.break.confirm', { length: t(LENGTH_COPY[days]) })}
          isDisabled={days === null || reason.trim().length < 3} isBusy={setBreak.isPending} onConfirm={() => void submit()} />
      </Stack>
      <BreakOutcome outcome={outcome} />
    </Stack>
  );
}
