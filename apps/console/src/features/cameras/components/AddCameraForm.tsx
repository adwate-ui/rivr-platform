import { zodResolver } from '@hookform/resolvers/zod';
import { cameraSchema } from '@rivr/contracts';
import type { FloorTable } from '@rivr/db';
import { useSaveCamera, type CameraFailure } from '@rivr/db/cctv';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CAMERA_FAILURE_COPY } from './cameraCopy.ts';

/** Where a camera looks: the cage, nowhere in particular, or a table by its id. */
const CAGE = 'cage';
const ELSEWHERE = 'elsewhere';

type Outcome = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly failure: CameraFailure };

/** Adds a camera: its name, the recorder's channel, and what it watches. */
export function AddCameraForm({ venueId, tables }: { venueId: string; tables: readonly FloorTable[] }) {
  const save = useSaveCamera(venueId);
  const [where, setWhere] = useState(ELSEWHERE);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [resolver] = useState(() => zodResolver(cameraSchema));
  const form = useForm<z.input<typeof cameraSchema>, unknown, z.output<typeof cameraSchema>>({ resolver, defaultValues: { name: '', channel: '' } });
  const submit = form.handleSubmit(async (camera) => {
    const isTable = where !== CAGE && where !== ELSEWHERE;
    const done = await save.mutateAsync({ cameraId: null, ...camera, tableId: isTable ? where : null, isCage: where === CAGE, isActive: true });
    setOutcome(done.ok ? { ok: true, name: camera.name } : { ok: false, failure: done.error });
    if (done.ok) {
      form.reset();
      setWhere(ELSEWHERE);
    }
  });
  const errors = form.formState.errors;
  const nameField = form.register('name');
  const channelField = form.register('channel');
  const places = [{ value: CAGE, label: t('console.cameras.cage') }, ...tables.map((table) => ({ value: table.id, label: table.name })),
    { value: ELSEWHERE, label: t('console.cameras.elsewhere') }];
  return (
    <Stack gap={4} align="start">
      <Heading level={2}>{t('console.cameras.addTitle')}</Heading>
      <Input {...nameField} label={t('console.cameras.name')} autoComplete="off" error={errors.name ? t('console.cameras.invalidName') : undefined} />
      <Input {...channelField} label={t('console.cameras.channel')} hint={t('console.cameras.channelHint')} autoComplete="off"
        error={errors.channel ? t('console.cameras.invalidChannel') : undefined} />
      <ChoiceChips label={t('console.cameras.watches')} mode="one" options={places} selected={[where]} onChange={([picked]) => setWhere(picked ?? ELSEWHERE)} />
      {outcome === null ? null : outcome.ok ? <Text>{t('console.cameras.added', { name: outcome.name })}</Text>
        : <ErrorMessage>{t(CAMERA_FAILURE_COPY[outcome.failure])}</ErrorMessage>}
      <Button variant="primary" isLoading={save.isPending} onClick={() => void submit()}>{t('console.cameras.add')}</Button>
    </Stack>
  );
}
