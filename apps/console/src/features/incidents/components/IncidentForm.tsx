import { zodResolver } from '@hookform/resolvers/zod';
import { INCIDENT_SEVERITIES, incidentSchema } from '@rivr/contracts';
import { useIncidentActions, type IncidentFailure, type Sop } from '@rivr/db';
import { clubDay, clubDayMoment } from '@rivr/domain/clubDay';
import type { Camera } from '@rivr/db/cctv';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import type { z } from 'zod';
import { failureText } from './incidentCopy.ts';

type IncidentFormControl = Control<z.input<typeof incidentSchema>, unknown, z.output<typeof incidentSchema>>;

/** The camera that saw it, if one did (#122): its playback then opens at the moment it happened. */
function CameraField({ control, cameras }: { control: IncidentFormControl; cameras: readonly Camera[] }) {
  const inUse = cameras.filter((camera) => camera.isActive);
  // With no camera in use there is nothing to choose; the camera note still takes one.
  if (inUse.length === 0) return null;
  return (
    <Controller control={control} name="cameraId" render={({ field }) => (
      <ChoiceChips label={t('console.incidents.camera')} mode="one"
        options={inUse.map((camera) => ({ value: camera.cameraId, label: camera.name }))}
        selected={field.value === null ? [] : [field.value]} onChange={([picked]) => field.onChange(picked ?? null)} />
    )} />
  );
}

const SEVERITIES = INCIDENT_SEVERITIES.map((value) => ({ value, label: t(`console.incidents.severities.${value}`) }));

/** When it happened: a time tonight on India's clock, or now (null) when none is given; `future` for one still to come. */
function occurredAtOf(at: string, now: Date): { readonly occurredAt: string | null } | 'future' {
  if (at === '') return { occurredAt: null };
  const moment = clubDayMoment(clubDay(now), at);
  return moment > now ? 'future' : { occurredAt: moment.toISOString() };
}

/** The form's state, and logging an incident with when it happened (#122: its playback opens then). */
function useLogIncident(venueId: string) {
  const { log } = useIncidentActions(venueId);
  const [outcome, setOutcome] = useState<IncidentFailure | 'logged' | null>(null);
  const [resolver] = useState(() => zodResolver(incidentSchema));
  const form = useForm<z.input<typeof incidentSchema>, unknown, z.output<typeof incidentSchema>>({
    resolver, defaultValues: { severity: 'low', summary: '', at: '', cctvReference: '', cameraId: null, sopId: null },
  });
  const submit = form.handleSubmit(async ({ at, ...incident }) => {
    const when = occurredAtOf(at, new Date());
    if (when === 'future') return form.setError('at', { type: 'future' });
    const logged = await log.mutateAsync({ ...incident, ...when });
    setOutcome(logged.ok ? 'logged' : logged.error);
    if (logged.ok) form.reset();
  });
  return { form, submit, outcome, isPending: log.isPending };
}

/** Logs an incident (#53): its severity, what happened and when, the camera that saw it, and the SOP followed. */
export function IncidentForm({ venueId, sops, cameras }: { venueId: string; sops: readonly Sop[]; cameras: readonly Camera[] }) {
  const { form, submit, outcome, isPending } = useLogIncident(venueId);
  const atError = form.formState.errors.at;
  const summaryField = form.register('summary');
  const atField = form.register('at');
  const cctvField = form.register('cctvReference');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.incidents.log')}</Heading>
      <Controller control={form.control} name="severity" render={({ field }) => (
        <ChoiceChips label={t('console.incidents.severity')} mode="one" options={SEVERITIES} selected={[field.value]}
          onChange={([picked]) => { if (picked) field.onChange(picked); }} />
      )} />
      <TextArea {...summaryField} label={t('console.incidents.summary')} rows={3}
        error={form.formState.errors.summary ? t('console.incidents.invalidIncident') : undefined} />
      <Input {...atField} label={t('console.incidents.at')} hint={t('console.incidents.atHint')} autoComplete="off"
        error={atError === undefined ? undefined : t(atError.type === 'future' ? 'console.incidents.futureAt' : 'console.incidents.invalidAt')} />
      <CameraField control={form.control} cameras={cameras} />
      <Input {...cctvField} label={t('console.incidents.cctv')} hint={t('console.incidents.cctvHint')} autoComplete="off" />
      <Controller control={form.control} name="sopId" render={({ field }) => (
        <ChoiceChips label={t('console.incidents.sop')} mode="one" options={sops.map((sop) => ({ value: sop.sopId, label: sop.title }))}
          selected={field.value === null ? [] : [field.value]} onChange={([picked]) => field.onChange(picked ?? null)} />
      )} />
      <Stack gap={2} align="start">
        <Button variant="secondary" isLoading={isPending} onClick={() => void submit()}>{t('console.incidents.logConfirm')}</Button>
        {outcome === 'logged' ? <Text variant="small">{t('console.incidents.logged')}</Text> : null}
        {outcome === null || outcome === 'logged' ? null : <ErrorMessage>{failureText(outcome)}</ErrorMessage>}
      </Stack>
    </Stack>
  );
}
