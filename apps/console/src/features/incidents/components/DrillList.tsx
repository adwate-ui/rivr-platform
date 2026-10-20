import { zodResolver } from '@hookform/resolvers/zod';
import { drillScheduleSchema } from '@rivr/contracts';
import { useIncidentActions, type Drill, type IncidentFailure, type Sop } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { dayText, failureText } from './incidentCopy.ts';

/** Schedules a drill four times, a quarter apart, for SOP managers. */
function ScheduleForm({ venueId, sops, onFailure }: { venueId: string; sops: readonly Sop[]; onFailure: (failure: IncidentFailure | null) => void }) {
  const { scheduleDrills } = useIncidentActions(venueId);
  const [resolver] = useState(() => zodResolver(drillScheduleSchema));
  const form = useForm<z.input<typeof drillScheduleSchema>, unknown, z.output<typeof drillScheduleSchema>>({
    resolver, defaultValues: { title: '', sopId: null, firstOn: '' },
  });
  const submit = form.handleSubmit(async (drill) => {
    const scheduled = await scheduleDrills.mutateAsync(drill);
    onFailure(scheduled.ok ? null : scheduled.error);
    if (scheduled.ok) form.reset();
  });
  const fields = { title: form.register('title'), firstOn: form.register('firstOn') };
  const isInvalid = form.formState.errors.title !== undefined || form.formState.errors.firstOn !== undefined;
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="sopId" render={({ field }) => (
        <ChoiceChips label={t('console.incidents.drillSop')} mode="one" options={sops.map((sop) => ({ value: sop.sopId, label: sop.title }))}
          selected={field.value === null ? [] : [field.value]} onChange={([picked]) => field.onChange(picked ?? null)} />
      )} />
      <Inline gap={3} align="end" wrap>
        <Input {...fields.title} label={t('console.incidents.drillTitle')} autoComplete="off" />
        <Input {...fields.firstOn} label={t('console.incidents.drillFirstOn')} type="date"
          error={isInvalid ? t('console.incidents.invalidDrill') : undefined} />
        <Button variant="secondary" isLoading={scheduleDrills.isPending} onClick={() => void submit()}>{t('console.incidents.scheduleDrills')}</Button>
      </Inline>
    </Stack>
  );
}

/** The venue's drills by date, held or not; SOP managers schedule them and mark them held. */
export function DrillList({ venueId, drills, sops, canManage }: { venueId: string; drills: readonly Drill[]; sops: readonly Sop[]; canManage: boolean }) {
  const { holdDrill } = useIncidentActions(venueId);
  const [failure, setFailure] = useState<IncidentFailure | null>(null);
  const hold = async (drillId: string) => {
    const held = await holdDrill.mutateAsync(drillId);
    setFailure(held.ok ? null : held.error);
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.incidents.drills')}</Heading>
      {drills.length === 0 ? <Text tone="muted">{t('console.incidents.noDrills')}</Text> : null}
      <Stack gap={2} divided>
        {drills.map((drill) => (
          <Inline key={drill.drillId} justify="between" align="center" wrap>
            <Stack gap={1}>
              <Text>{t('console.incidents.drill', { title: drill.title, date: dayText(drill.scheduledOn) })}</Text>
              <Text variant="small" tone="muted">
                {drill.heldOn === null ? t('console.incidents.drillDue') : t('console.incidents.drillHeld', { date: dayText(drill.heldOn) })}
              </Text>
            </Stack>
            {canManage && drill.heldOn === null ? (
              <Button variant="text" onClick={() => void hold(drill.drillId)}>{t('console.incidents.holdDrill')}</Button>
            ) : null}
          </Inline>
        ))}
      </Stack>
      {canManage ? <ScheduleForm venueId={venueId} sops={sops} onFailure={setFailure} /> : null}
      {failure === null ? null : <ErrorMessage>{failureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
