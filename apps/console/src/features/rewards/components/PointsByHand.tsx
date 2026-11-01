import { useGivePoints, useMemberPoints, type MemberPoints, type PointsOrder } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Heading, Inline, Input, Number as Figure, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

const INDIA = '+91';

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
  const digits = typed.replace(/\D/g, '');
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.rewards.byHand.heading')}</Heading>
      <Inline gap={3} align="end">
        <Input label={t('console.rewards.byHand.phone')} type="tel" inputMode="numeric" prefix={INDIA} maxLength={14} value={typed}
          onChange={(event) => setTyped(event.target.value)} />
        <Button variant="secondary" isDisabled={!isMobile(digits)} isLoading={phone !== null && member.isFetching} onClick={() => setPhone(digits)}>
          {t('console.rewards.byHand.find')}
        </Button>
      </Inline>
      {member.isError ? <ErrorMessage>{t('console.rewards.byHand.failures.unavailable')}</ErrorMessage> : null}
      {member.data === null ? <Text tone="muted">{t('console.rewards.byHand.notFound')}</Text> : null}
      {member.data ? <PointsForm key={member.data.memberId} venueId={venueId} member={member.data} /> : null}
    </Stack>
  );
}

// 1 to 1,000,000 points with a reason of 3 characters or more, as points_member checks.
const isChange = (points: string, reason: string) => /^\d{1,7}$/.test(points) && Number(points) >= 1 && Number(points) <= 1_000_000 && reason.trim().length >= 3;

type Outcome = { ok: boolean; text: string } | null;

/** Runs one change: one request id a change, kept only to retry the same one after an answer that may not have gone through. */
function usePointsChange(venueId: string, member: MemberPoints) {
  const give = useGivePoints(venueId);
  const [attempt, setAttempt] = useState<{ action: PointsOrder['action']; requestId: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const run = async (action: PointsOrder['action'], points: bigint, reason: string) => {
    const requestId = attempt?.action === action ? attempt.requestId : crypto.randomUUID();
    setAttempt({ action, requestId });
    const done = await give.mutateAsync({ memberId: member.memberId, action, points, reason, requestId });
    if (done.ok || done.error !== 'unavailable') setAttempt(null);
    setOutcome(done.ok
      ? { ok: true, text: t(`console.rewards.byHand.done.${action}`, { points: formatNumber(points), name: member.fullName }) }
      : { ok: false, text: t(`console.rewards.byHand.failures.${done.error}`) });
    return done.ok;
  };
  return { run, outcome, isPending: give.isPending, reset: () => { setAttempt(null); setOutcome(null); } };
}

/** One member's points, and the form that changes them. */
function PointsForm({ venueId, member }: { venueId: string; member: MemberPoints }) {
  const change = usePointsChange(venueId, member);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const isOff = !isChange(points, reason) || change.isPending;
  const run = async (action: PointsOrder['action']) => {
    if (await change.run(action, BigInt(points), reason)) { setPoints(''); setReason(''); }
  };
  return (
    <Stack gap={4}>
      <PointsHeld member={member} />
      <Inline gap={4} wrap>
        <Input label={t('console.rewards.byHand.points')} inputMode="numeric" maxLength={7} value={points}
          onChange={(event) => { setPoints(event.target.value.trim()); change.reset(); }} />
        <Input label={t('console.rewards.byHand.reason')} maxLength={200} value={reason} onChange={(event) => { setReason(event.target.value); change.reset(); }} />
      </Inline>
      <Inline gap={3} wrap>
        <Button variant="primary" isDisabled={isOff} onClick={() => void run('earned')}>{t('console.rewards.byHand.giveEarned')}</Button>
        <Button variant="secondary" isDisabled={isOff} onClick={() => void run('locked')}>{t('console.rewards.byHand.giveLocked')}</Button>
        <Button variant="secondary" isDisabled={isOff || member.locked === 0n} onClick={() => void run('unlock')}>{t('console.rewards.byHand.unlock')}</Button>
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
        <Stack gap={1}><Text variant="small" tone="muted">{t('console.rewards.byHand.earned')}</Text><Figure value={member.earned} size="title" /></Stack>
        <Stack gap={1}><Text variant="small" tone="muted">{t('console.rewards.byHand.locked')}</Text><Figure value={member.locked} size="title" /></Stack>
      </Grid>
      <Text variant="small" tone="muted">{t('console.rewards.byHand.lockedHint')}</Text>
    </Stack>
  );
}
