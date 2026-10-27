import { useMemberActions, useVenueTiers, type MemberFailure, type MemberRecord } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, LoadState, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

const FAILURE_COPY: Readonly<Record<MemberFailure, MessageKey>> = {
  not_allowed: 'console.members.failures.notAllowed',
  no_member: 'console.members.failures.noMember',
  invalid: 'console.members.failures.invalid',
  paused: 'console.members.failures.paused',
  unavailable: 'console.members.failures.unavailable',
};

function Outcome({ outcome }: { outcome: MemberFailure | 'saved' | null }) {
  return (
    <>
      <StatusMessage>{outcome === 'saved' ? t('console.members.saved') : null}</StatusMessage>
      {outcome === null || outcome === 'saved' ? null : <ErrorMessage>{t(FAILURE_COPY[outcome])}</ErrorMessage>}
    </>
  );
}

/** The tiers to choose from, once they have loaded; or why not. */
function TierChoice({ tiers, options, tierId, onChange }: {
  tiers: ReturnType<typeof useVenueTiers>; options: { value: string; label: string }[]; tierId: string | null; onChange: (tierId: string | null) => void;
}) {
  if (tiers.isError) {
    return (
      <Stack gap={2}>
        <ErrorMessage>{t('console.members.tiersUnavailable')}</ErrorMessage>
        <Button variant="text" onClick={() => void tiers.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (tiers.data === undefined) return <LoadState />;
  return (
    <ChoiceChips label={t('console.members.newTier')} mode="one" options={options} selected={tierId === null ? [] : [tierId]}
      onChange={([chosen]) => onChange(chosen ?? null)} />
  );
}

/**
 * Changes a member's tier (#60), for staff with members.manage: the new tier, why, and an optional last
 * day, after which they go back. Every change is kept with its reason and the staff member.
 */
export function TierForm({ venueId, record }: { venueId: string; record: MemberRecord }) {
  const tiers = useVenueTiers(venueId);
  const { setTier } = useMemberActions(venueId);
  const [tierId, setTierId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [outcome, setOutcome] = useState<MemberFailure | 'saved' | null>(null);
  const options = (tiers.data ?? []).filter((tier) => tier.tierId !== record.tierId).map((tier) => ({ value: tier.tierId, label: tier.name }));
  const submit = async () => {
    if (tierId === null) return;
    const done = await setTier.mutateAsync({ memberId: record.memberId, tierId, reason: reason.trim(), until: until === '' ? null : until });
    setOutcome(done.ok ? 'saved' : done.error);
    if (done.ok) { setTierId(null); setReason(''); setUntil(''); }
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.tierChange')}</Heading>
      <TierChoice tiers={tiers} options={options} tierId={tierId} onChange={setTierId} />
      <Input label={t('console.members.reason')} hint={t('console.members.reasonHint')} value={reason} maxLength={500} autoComplete="off"
        onChange={(event) => setReason(event.target.value)} />
      <Input type="date" label={t('console.members.until')} hint={t('console.members.untilHint')} value={until} onChange={(event) => setUntil(event.target.value)} />
      <Button variant="secondary" isDisabled={tierId === null || reason.trim().length < 3} isLoading={setTier.isPending} onClick={() => void submit()}>
        {t('console.members.save')}
      </Button>
      <Outcome outcome={outcome} />
    </Stack>
  );
}
