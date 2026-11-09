import { zodResolver } from '@hookform/resolvers/zod';
import { deviceRevokeSchema, type TvMode } from '@rivr/contracts';
import { useTvActions, type TvFailure, type VenueTv } from '@rivr/db';
import { formatDateTime, t } from '@rivr/i18n';
import { DotStatus, ErrorMessage, Inline, OverflowMenu, ReasonForm, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ModeChips, RotationChips, TV_FAILURE_COPY } from './tvCopy.tsx';

type Outcome = { ok: true } | { ok: false; error: TvFailure };

/** Unpairs a TV, with the reason: it signs itself out within seconds and shows a new code. */
function UnpairForm({ venueId, tv, onDone }: { venueId: string; tv: VenueTv; onDone: (outcome: Outcome | null) => void }) {
  const { unpair } = useTvActions(venueId);
  const [resolver] = useState(() => zodResolver(deviceRevokeSchema));
  const form = useForm<z.input<typeof deviceRevokeSchema>, unknown, z.output<typeof deviceRevokeSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => onDone(await unpair.mutateAsync({ deviceId: tv.deviceId, reason })));
  return (
    <ReasonForm field={form.register('reason')} label={t('console.tvs.unpairReason')}
      error={form.formState.errors.reason ? t('console.tvs.invalidReason') : undefined}
      actions={[{ label: t('console.tvs.unpairConfirm'), onClick: () => void submit() }]}
      isLoading={unpair.isPending} onCancel={() => onDone(null)} />
  );
}

/** Whether the TV is on and the board it was set to, or when it was last on; before it picks up its login, that it is waited for. */
export function TvStatus({ tv }: { tv: VenueTv }) {
  if (!tv.isPaired) return <Text variant="small" tone="muted">{t('console.tvs.waiting')}</Text>;
  if (tv.isOnline) return <DotStatus tone="active" label={tv.mode === null ? t('console.tvs.online') : t('console.tvs.showing', { board: t(`tv.modes.${tv.mode}`) })} />;
  return <DotStatus tone="inactive" label={tv.lastSeenAt === null ? t('console.tvs.offline') : t('console.tvs.lastSeen', { when: formatDateTime(new Date(tv.lastSeenAt)) })} />;
}

/** One TV: whether it is on, what it shows, what it turns to in between (decision 0163), and Unpair behind its ⋯. */
export function TvRow({ venueId, tv }: { venueId: string; tv: VenueTv }) {
  const { setMode, setRotation } = useTvActions(venueId);
  const [isUnpairing, setIsUnpairing] = useState(false);
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const settle = (outcome: Outcome) => setFailure(outcome.ok ? null : outcome.error);
  const show = async (mode: TvMode) => settle(await setMode.mutateAsync({ deviceId: tv.deviceId, mode }));
  const turnTo = async (rotation: TvMode[]) => settle(await setRotation.mutateAsync({ deviceId: tv.deviceId, rotation }));
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text weight="semibold">{tv.name}</Text>
          <TvStatus tv={tv} />
        </Stack>
        <OverflowMenu label={t('console.tvs.more', { name: tv.name })}
          items={[{ id: 'unpair', label: t('console.tvs.unpair'), tone: 'danger', onSelect: () => setIsUnpairing(true) }]} />
      </Inline>
      <ModeChips label={t('console.tvs.modeFor', { name: tv.name })} value={tv.mode} isDisabled={setMode.isPending}
        onChange={(mode) => void show(mode)} />
      {tv.mode === null ? null : (
        <Stack gap={1}>
          <RotationChips label={t('console.tvs.rotationFor', { name: tv.name })} mode={tv.mode} value={tv.rotation}
            isDisabled={setRotation.isPending} onChange={(rotation) => void turnTo(rotation)} />
          <Text variant="small" tone="muted">{t('console.tvs.rotationHint')}</Text>
        </Stack>
      )}
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
