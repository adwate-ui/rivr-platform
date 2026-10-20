import { useControlActions, useEngagedControls, type ControlFailure, type EngagedControl } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { controlName } from './controlCopy.ts';

/** What happened to a release: released, asked (a freeze waiting for a second super admin), or why not. */
export type ReleaseOutcome = 'released' | 'awaiting_second' | ControlFailure;

/** Releases one control: with a reason, or for a freeze another super admin asked to release, as the second. */
function ReleaseForm({ venueId, control, onDone, onCancel }: {
  venueId: string; control: EngagedControl; onDone: (outcome: ReleaseOutcome) => void; onCancel: () => void;
}) {
  const { release } = useControlActions(venueId);
  const [reason, setReason] = useState('');
  const isSecond = control.releaseAsk !== null;
  const submit = async () => {
    const done = await release.mutateAsync({ controlId: control.controlId, reason: reason.trim() });
    onDone(done.ok ? done.value : done.error);
  };
  return (
    <Stack gap={3}>
      {isSecond ? null : <Input label={t('console.killSwitch.releaseReason')} value={reason} maxLength={500} autoComplete="off" onChange={(event) => setReason(event.target.value)} />}
      <Inline gap={3}>
        <Button variant="secondary" isDisabled={!isSecond && reason.trim().length < 3} isLoading={release.isPending} onClick={() => void submit()}>
          {t('console.killSwitch.release')}
        </Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

function ControlRow({ control, onRelease }: { control: EngagedControl; onRelease: () => void }) {
  const what = controlName(control);
  return (
    <Inline justify="between" align="center" gap={4}>
      <Stack gap={1}>
        <Text>{t('console.killSwitch.line', { what, reason: control.reason, name: control.engagedBy ?? '', time: formatDayTime(new Date(control.engagedAt)) })}</Text>
        {control.releaseAsk === null ? null : (
          <Text variant="small" tone="muted">{t('console.killSwitch.releaseAsked', { name: control.releaseAsk.by, reason: control.releaseAsk.reason })}</Text>
        )}
      </Stack>
      <Button variant="text" aria-label={t('console.killSwitch.releaseName', { what })} onClick={onRelease}>{t('console.killSwitch.release')}</Button>
    </Inline>
  );
}

function Body({ venueId, onOutcome }: { venueId: string; onOutcome: (outcome: ReleaseOutcome) => void }) {
  const controls = useEngagedControls(venueId);
  const [releasing, setReleasing] = useState<EngagedControl | null>(null);
  if (controls.isError) return <Text tone="muted">{t('common.loadFailed')}</Text>;
  if (controls.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  if (controls.data.length === 0) return <Text tone="muted">{t('console.killSwitch.noneEngaged')}</Text>;
  return (
    <Stack gap={4}>
      <Stack gap={3} divided>
        {controls.data.map((control) => <ControlRow key={control.controlId} control={control} onRelease={() => setReleasing(control)} />)}
      </Stack>
      {releasing === null ? null : (
        <ReleaseForm key={releasing.controlId} venueId={venueId} control={releasing} onCancel={() => setReleasing(null)}
          onDone={(outcome) => { onOutcome(outcome); if (outcome === 'released' || outcome === 'awaiting_second') setReleasing(null); }} />
      )}
    </Stack>
  );
}

/** The venue's engaged controls (#27), newest first, each released with a reason; a venue freeze by two super admins. */
export function EngagedControls({ venueId, onOutcome }: { venueId: string; onOutcome: (outcome: ReleaseOutcome) => void }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.killSwitch.engagedTitle')}</Heading>
      <Body venueId={venueId} onOutcome={onOutcome} />
    </Stack>
  );
}
