import { zodResolver } from '@hookform/resolvers/zod';
import { INCIDENT_SEVERITIES, incidentSchema } from '@rivr/contracts';
import { useIncidentActions, type IncidentFailure, type Sop } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { failureText } from './incidentCopy.ts';

const SEVERITIES = INCIDENT_SEVERITIES.map((value) => ({ value, label: t(`console.incidents.severities.${value}`) }));

/** Logs an incident (#53): its severity, what happened, the camera and time if one saw it, and the SOP followed. */
export function IncidentForm({ venueId, sops }: { venueId: string; sops: readonly Sop[] }) {
  const { log } = useIncidentActions(venueId);
  const [outcome, setOutcome] = useState<IncidentFailure | 'logged' | null>(null);
  const [resolver] = useState(() => zodResolver(incidentSchema));
  const form = useForm<z.input<typeof incidentSchema>, unknown, z.output<typeof incidentSchema>>({
    resolver, defaultValues: { severity: 'low', summary: '', cctvReference: '', sopId: null },
  });
  const submit = form.handleSubmit(async (incident) => {
    const logged = await log.mutateAsync(incident);
    setOutcome(logged.ok ? 'logged' : logged.error);
    if (logged.ok) form.reset();
  });
  const summaryField = form.register('summary');
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
      <Input {...cctvField} label={t('console.incidents.cctv')} hint={t('console.incidents.cctvHint')} autoComplete="off" />
      <Controller control={form.control} name="sopId" render={({ field }) => (
        <ChoiceChips label={t('console.incidents.sop')} mode="one" options={sops.map((sop) => ({ value: sop.sopId, label: sop.title }))}
          selected={field.value === null ? [] : [field.value]} onChange={([picked]) => field.onChange(picked ?? null)} />
      )} />
      <Stack gap={2} align="start">
        <Button variant="secondary" isLoading={log.isPending} onClick={() => void submit()}>{t('console.incidents.logConfirm')}</Button>
        {outcome === 'logged' ? <Text variant="small">{t('console.incidents.logged')}</Text> : null}
        {outcome === null || outcome === 'logged' ? null : <ErrorMessage>{failureText(outcome)}</ErrorMessage>}
      </Stack>
    </Stack>
  );
}
