import { useGiveLeaguePoints, useGivePoints, useMemberPoints, type MemberPoints, type PointsFailure, type PointsOrder } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Heading, Inline, Input, Number as Figure, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

// An Indian mobile number, as member.phone keeps them.
const isMobile = (digits: string) => /^[6-9]\d{9}$/.test(digits);

/**
 * Points by hand (#645; owner's feedback doc of 29 Oct, super admin module 11), for staff who keep the rewards: find a
 * member by their mobile number, see their earned and locked points, give points as either, or unlock locked ones.
 */
export function PointsByHand({ venueId }: { venueId: string }) {
  const [typed, setTyped] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const member = useMemberPoints(venueId, phone);
  // Ten digits, or the same typed after +91.
  const digits = typed.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return (
    <Stack gap={4}>
      <Heading level={2} variant="card">{t('console.rewards.byHand.heading')}</Heading>
      {/* The field and Find, both 36 px at a desk, centred on one line. */}
      <Inline gap={3} align="center">
        <Input variant="subtle" label={t('console.rewards.byHand.phone')} type="tel" inputMode="numeric" maxLength={16} value={typed}
          onChange={(event) => setTyped(event.target.value)} />
        <Button variant="subtle" size="compact" isDisabled={!isMobile(digits)} isLoading={phone !== null && member.isFetching} onClick={() => setPhone(digits)}>
          {t('console.rewards.byHand.find')}
        </Button>
      </Inline>
      {member.isError ? <ErrorMessage>{t('common.loadFailed')}</ErrorMessage> : null}
      {member.data === null ? <Text tone="muted">{t('console.rewards.byHand.notFound')}</Text> : null}
      {member.data ? <PointsForm key={member.data.memberId} venueId={venueId} member={member.data} /> : null}
    </Stack>
  );
}

// 1 to 1,000,000 points with a reason of 3 characters or more, as points_member checks.
const isChange = (points: string, reason: string) => /^\d{1,7}$/.test(points) && Number(points) >= 1 && Number(points) <= 1_000_000 && reason.trim().length >= 3;

type Outcome = { ok: boolean; text: string } | null;

/** A change of reward points, or League points given (L-01): they rank the member this month and are never spent. */
type Action = PointsOrder['action'] | 'league';

/** Runs one change: one request id a change, kept only to retry the same one after an answer that may not have gone through. */
function usePointsChange(venueId: string, member: MemberPoints) {
  const give = useGivePoints(venueId);
  const giveLeague = useGiveLeaguePoints(venueId);
  const [attempt, setAttempt] = useState<{ action: Action; requestId: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  // Both answer with the same refusals: League points are given to the member found, by their number.
  const send = async (action: Action, points: bigint, reason: string, requestId: string): Promise<PointsFailure | null> => {
    if (action !== 'league') {
      const done = await give.mutateAsync({ memberId: member.memberId, action, points, reason, requestId });
      return done.ok ? null : done.error;
    }
    const done = await giveLeague.mutateAsync({ rows: [{ memberNumber: member.memberNumber, points }], reason, requestId });
    return done.ok ? null : done.error.kind;
  };
  const run = async (action: Action, points: bigint, reason: string) => {
    const requestId = attempt?.action === action ? attempt.requestId : crypto.randomUUID();
    setAttempt({ action, requestId });
    const failure = await send(action, points, reason, requestId);
    if (failure !== 'unavailable') setAttempt(null);
    setOutcome(failure === null
      ? { ok: true, text: t(`console.rewards.byHand.done.${action}`, { points: formatNumber(points), name: member.fullName }) }
      : { ok: false, text: t(`console.rewards.byHand.failures.${failure}`) });
    return failure === null;
  };
  return { run, outcome, isPending: give.isPending || giveLeague.isPending, reset: () => { setAttempt(null); setOutcome(null); } };
}

/** One member's points, and the form that changes them. */
function PointsForm({ venueId, member }: { venueId: string; member: MemberPoints }) {
  const change = usePointsChange(venueId, member);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const isOff = !isChange(points, reason) || change.isPending;
  const run = async (action: Action) => {
    if (await change.run(action, BigInt(points), reason)) { setPoints(''); setReason(''); }
  };
  return (
    <Stack gap={4}>
      <PointsHeld member={member} />
      <Inline gap={4} wrap>
        <Input variant="subtle" label={t('console.rewards.byHand.points')} inputMode="numeric" maxLength={7} value={points}
          onChange={(event) => { setPoints(event.target.value.trim()); change.reset(); }} />
        <Input variant="subtle" label={t('console.rewards.byHand.reason')} maxLength={200} value={reason} onChange={(event) => { setReason(event.target.value); change.reset(); }} />
      </Inline>
      <Inline gap={3} wrap>
        <Button variant="strong" size="compact" isDisabled={isOff} onClick={() => void run('earned')}>{t('console.rewards.byHand.giveEarned')}</Button>
        <Button variant="subtle" size="compact" isDisabled={isOff} onClick={() => void run('locked')}>{t('console.rewards.byHand.giveLocked')}</Button>
        <Button variant="subtle" size="compact" isDisabled={isOff || member.locked === 0n} onClick={() => void run('unlock')}>{t('console.rewards.byHand.unlock')}</Button>
        <Button variant="subtle" size="compact" isDisabled={isOff} onClick={() => void run('league')}>{t('console.rewards.byHand.giveLeague')}</Button>
      </Inline>
      <StatusMessage>{change.outcome?.ok === true ? change.outcome.text : null}</StatusMessage>
      {change.outcome?.ok === false ? <ErrorMessage>{change.outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}

/** Who the member is, and the points they hold, earned and locked. */
function PointsHeld({ member }: { member: MemberPoints }) {
  return (
    <Stack gap={4}>
      <Text variant="lead">{t('console.rewards.byHand.member', { name: member.fullName, number: String(member.memberNumber) })}</Text>
      <Grid columns={2} gap={6}>
        <Stack gap={1}><Text variant="secondary" tone="muted">{t('console.rewards.byHand.earned')}</Text><Figure value={member.earned} size="title" /></Stack>
        <Stack gap={1}><Text variant="secondary" tone="muted">{t('console.rewards.byHand.locked')}</Text><Figure value={member.locked} size="title" /></Stack>
      </Grid>
      <Text variant="secondary" tone="muted">{t('console.rewards.byHand.lockedHint')}</Text>
    </Stack>
  );
}
