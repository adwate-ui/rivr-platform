import { useFeature } from '@rivr/db';
import { useMyCab, useMyCabRequests, useRequestCab, type CabFailure, type MyCab } from '@rivr/db/myRewards';
import { formatTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, FeatureGate, Heading, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

type Kind = 'pickup' | 'drop';
const KINDS: readonly Kind[] = ['pickup', 'drop'];

/**
 * A cab (#140; feature cab.requests): shown only once the member has the club's visits this month (cab.minimum_visits,
 * four unless set). They ask for a pickup or a drop, where and at what time, and see what they asked for.
 */
export function CabSection() {
  const access = useFeature('cab.requests');
  return <FeatureGate access={access}><Cab /></FeatureGate>;
}

function Cab() {
  const cab = useMyCab();
  if (!cab.data?.isEligible) return null;
  return <CabForm cab={cab.data} />;
}

function CabForm({ cab }: { cab: MyCab }) {
  const requests = useMyCabRequests();
  const request = useRequestCab();
  const [kind, setKind] = useState<Kind>('pickup');
  const [address, setAddress] = useState('');
  const [time, setTime] = useState('');
  const [failure, setFailure] = useState<CabFailure | null>(null);
  const ask = async () => {
    const asked = await request.mutateAsync({ kind, address, time });
    setFailure(asked.ok ? null : asked.error);
    if (asked.ok) setAddress('');
  };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('memberRewards.cab.title')}</Heading>
      <Text>{t('memberRewards.cab.how', { visits: cab.visits })}</Text>
      <ChoiceChips label={t('memberRewards.cab.kind')} mode="one" selected={[kind]}
        options={KINDS.map((value) => ({ value, label: t(`memberRewards.cab.kinds.${value}`) }))}
        onChange={([picked]) => { const found = KINDS.find((known) => known === picked); if (found) setKind(found); }} />
      <Input label={t('memberRewards.cab.address')} value={address} maxLength={200} onChange={(event) => setAddress(event.target.value)} />
      <Input label={t('memberRewards.cab.time')} value={time} inputMode="numeric" maxLength={5} onChange={(event) => setTime(event.target.value)} />
      <Button variant="secondary" isLoading={request.isPending} onClick={() => void ask()}>{t('memberRewards.cab.request')}</Button>
      {failure === null ? null : <ErrorMessage>{t(`memberRewards.cab.failures.${failure}`)}</ErrorMessage>}
      <StatusMessage>
        {(requests.data ?? []).map((asked) => t('memberRewards.cab.asked', {
          kind: t(`memberRewards.cab.kinds.${asked.kind}`), time: formatTime(new Date(asked.wantedAt)), address: asked.address,
        })).join(' ')}
      </StatusMessage>
    </Stack>
  );
}
