import { zodResolver } from '@hookform/resolvers/zod';
import { deviceRevokeSchema, type TvMode } from '@rivr/contracts';
import { useTvActions, type TvFailure, type VenueTv } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ModeChips, TV_FAILURE_COPY } from './tvCopy.tsx';

type Outcome = { ok: true } | { ok: false; error: TvFailure };

/** Unpairs a TV, with the reason: it signs itself out within seconds and shows a new code. */
function UnpairForm({ venueId, tv, onDone }: { venueId: string; tv: VenueTv; onDone: (outcome: Outcome | null) => void }) {
  const { unpair } = useTvActions(venueId);
  const [resolver] = useState(() => zodResolver(deviceRevokeSchema));
  const form = useForm<z.input<typeof deviceRevokeSchema>, unknown, z.output<typeof deviceRevokeSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => onDone(await unpair.mutateAsync({ deviceId: tv.deviceId, reason })));
  const reasonField = form.register('reason');
  return (
    <Inline gap={3} align="end">
      <Input {...reasonField} label={t('console.tvs.unpairReason')} autoComplete="off"
        error={form.formState.errors.reason ? t('console.tvs.invalidReason') : undefined} />
      <Button variant="danger" isLoading={unpair.isPending} onClick={() => void submit()}>{t('console.tvs.unpairConfirm')}</Button>
      <Button variant="text" onClick={() => onDone(null)}>{t('common.cancel')}</Button>
    </Inline>
  );
}

/** One TV: paired or still waiting for the TV, what it shows, and Unpair. */
export function TvRow({ venueId, tv }: { venueId: string; tv: VenueTv }) {
  const { setMode } = useTvActions(venueId);
  const [isUnpairing, setIsUnpairing] = useState(false);
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const settle = (outcome: Outcome) => setFailure(outcome.ok ? null : outcome.error);
  const show = async (mode: TvMode) => settle(await setMode.mutateAsync({ deviceId: tv.deviceId, mode }));
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text weight="semibold">{tv.name}</Text>
          <Text variant="small" tone="muted">{t(tv.isPaired ? 'console.tvs.paired' : 'console.tvs.waiting')}</Text>
        </Stack>
        <Button variant="text" onClick={() => setIsUnpairing(true)}>{t('console.tvs.unpair', { name: tv.name })}</Button>
      </Inline>
      <ModeChips label={t('console.tvs.modeFor', { name: tv.name })} value={tv.mode} isDisabled={setMode.isPending}
        onChange={(mode) => void show(mode)} />
      {isUnpairing ? (
        <UnpairForm venueId={venueId} tv={tv} onDone={(outcome) => {
          setIsUnpairing(false);
          if (outcome !== null) settle(outcome);
        }} />
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(TV_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
