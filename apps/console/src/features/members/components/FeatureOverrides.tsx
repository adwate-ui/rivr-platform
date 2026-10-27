import {
  useFeatureOverrideActions, useGateableFeatures, useMemberFeatureOverrides, type FeatureOverride, type OverrideFailure,
} from '@rivr/db';
import { formatDate, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text, LoadState, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

const FAILURE_COPY: Readonly<Record<OverrideFailure, MessageKey>> = {
  not_allowed: 'console.members.overrides.failures.notAllowed',
  no_member: 'console.members.overrides.failures.noMember',
  invalid: 'console.members.overrides.failures.invalid',
  not_in_force: 'console.members.overrides.failures.notInForce',
  paused: 'console.members.overrides.failures.paused',
  unavailable: 'console.members.overrides.failures.unavailable',
};

type Outcome = OverrideFailure | 'saved' | 'lifted' | null;

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  const done = outcome === 'saved' || outcome === 'lifted' ? t(`console.members.overrides.${outcome}`) : null;
  return (
    <>
      <StatusMessage>{done}</StatusMessage>
      {outcome === null || outcome === 'saved' || outcome === 'lifted' ? null : <ErrorMessage>{t(FAILURE_COPY[outcome])}</ErrorMessage>}
    </>
  );
}

function line(override: FeatureOverride): string {
  const what = override.isGranted ? t('console.members.overrides.granted') : t('console.members.overrides.takenAway');
  const common = { feature: override.featureName, what, reason: override.reason, name: override.staffName ?? '' };
  if (override.until === null) return t('console.members.overrides.line', common);
  return t('console.members.overrides.lineUntil', { ...common, date: formatDate(new Date(`${override.until}T12:00:00+05:30`)) });
}

/** How an override that is no longer in force ended: lifted (by whom, why), replaced, or on its last day. */
function standing(override: FeatureOverride): string {
  if (override.lift !== null) return t('console.members.overrides.liftedBy', { name: override.lift.by, reason: override.lift.reason });
  return override.standing === 'replaced' ? t('console.members.overrides.replaced') : t('console.members.overrides.ended');
}

/** Lifts one override in force, with a reason. */
function LiftForm({ venueId, override, onDone, onCancel }: {
  venueId: string; override: FeatureOverride; onDone: (outcome: Outcome) => void; onCancel: () => void;
}) {
  const { lift } = useFeatureOverrideActions(venueId);
  const [reason, setReason] = useState('');
  const submit = async () => {
    const done = await lift.mutateAsync({ overrideId: override.overrideId, reason: reason.trim() });
    onDone(done.ok ? 'lifted' : done.error);
  };
  return (
    <Stack gap={3}>
      <Input label={t('console.members.overrides.liftReason')} value={reason} maxLength={500} autoComplete="off" onChange={(event) => setReason(event.target.value)} />
      <Inline gap={3}>
        <Button variant="secondary" isDisabled={reason.trim().length < 3} isLoading={lift.isPending} onClick={() => void submit()}>
          {t('console.members.overrides.lift')}
        </Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

function OverrideRow({ override, onLift }: { override: FeatureOverride; onLift: () => void }) {
  const isInForce = override.standing === 'in_force';
  return (
    <Inline justify="between" align="center" gap={4}>
      <Stack gap={1}>
        <Text tone={isInForce ? 'default' : 'muted'}>{line(override)}</Text>
        {isInForce ? null : <Text variant="small" tone="muted">{standing(override)}</Text>}
      </Stack>
      {isInForce ? (
        <Button variant="text" aria-label={t('console.members.overrides.liftName', { feature: override.featureName })} onClick={onLift}>
          {t('console.members.overrides.lift')}
        </Button>
      ) : null}
    </Inline>
  );
}

function OverrideList({ venueId, memberId, onOutcome }: { venueId: string; memberId: string; onOutcome: (outcome: Outcome) => void }) {
  const overrides = useMemberFeatureOverrides(venueId, memberId);
  const [lifting, setLifting] = useState<FeatureOverride | null>(null);
  if (overrides.isError) return <Text tone="muted">{t('common.loadFailed')}</Text>;
  if (overrides.data === undefined) return <LoadState />;
  if (overrides.data.length === 0) return <Text tone="muted">{t('console.members.overrides.none')}</Text>;
  return (
    <Stack gap={3}>
      <Stack gap={2} divided>
        {overrides.data.map((override) => <OverrideRow key={override.overrideId} override={override} onLift={() => setLifting(override)} />)}
      </Stack>
      {lifting === null ? null : (
        <LiftForm key={lifting.overrideId} venueId={venueId} override={lifting} onCancel={() => setLifting(null)}
          onDone={(outcome) => { onOutcome(outcome); if (outcome === 'lifted') setLifting(null); }} />
      )}
    </Stack>
  );
}

/** The gateable features to choose from, once they have loaded; or why not. */
function FeatureChoice({ featureKey, onChange }: { featureKey: string | null; onChange: (featureKey: string | null) => void }) {
  const features = useGateableFeatures();
  if (features.isError) {
    return (
      <Stack gap={2}>
        <ErrorMessage>{t('console.members.overrides.featuresUnavailable')}</ErrorMessage>
        <Button variant="text" onClick={() => void features.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (features.data === undefined) return <LoadState />;
  return (
    <ChoiceChips label={t('console.members.overrides.feature')} mode="one" selected={featureKey === null ? [] : [featureKey]}
      options={features.data.map((feature) => ({ value: feature.key, label: feature.name }))} onChange={([chosen]) => onChange(chosen ?? null)} />
  );
}

function OverrideForm({ venueId, memberId, onOutcome }: { venueId: string; memberId: string; onOutcome: (outcome: Outcome) => void }) {
  const { set } = useFeatureOverrideActions(venueId);
  const [featureKey, setFeatureKey] = useState<string | null>(null);
  const [kind, setKind] = useState<'grant' | 'takeAway'>('takeAway');
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const submit = async () => {
    if (featureKey === null) return;
    const done = await set.mutateAsync({ memberId, featureKey, isGranted: kind === 'grant', reason: reason.trim(), until: until === '' ? null : until });
    onOutcome(done.ok ? 'saved' : done.error);
    if (done.ok) { setFeatureKey(null); setReason(''); setUntil(''); }
  };
  return (
    <Stack gap={3}>
      <FeatureChoice featureKey={featureKey} onChange={setFeatureKey} />
      <ChoiceChips label={t('console.members.overrides.kind')} mode="one" selected={[kind]}
        options={[{ value: 'takeAway', label: t('console.members.overrides.takeAway') }, { value: 'grant', label: t('console.members.overrides.grant') }]}
        onChange={([chosen]) => { if (chosen !== undefined) setKind(chosen); }} />
      <Input label={t('console.members.overrides.reason')} hint={t('console.members.reasonHint')} value={reason} maxLength={500} autoComplete="off"
        onChange={(event) => setReason(event.target.value)} />
      <Input type="date" label={t('console.members.overrides.until')} hint={t('console.members.overrides.untilHint')} value={until}
        onChange={(event) => setUntil(event.target.value)} />
      <Button variant="secondary" isDisabled={featureKey === null || reason.trim().length < 3} isLoading={set.isPending} onClick={() => void submit()}>
        {t('console.members.overrides.save')}
      </Button>
    </Stack>
  );
}

/**
 * A member's feature overrides (#61; additions "Tier-gated features"), for super admins only: one
 * gateable feature granted or taken away for this member, with a reason and an optional last day, in
 * place of their tier's; one in force can be lifted early, with a reason.
 */
export function FeatureOverrides({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.overrides.title')}</Heading>
      <OverrideList venueId={venueId} memberId={memberId} onOutcome={setOutcome} />
      <Heading level={4}>{t('console.members.overrides.newOverride')}</Heading>
      <OverrideForm venueId={venueId} memberId={memberId} onOutcome={setOutcome} />
      <OutcomeLine outcome={outcome} />
    </Stack>
  );
}
