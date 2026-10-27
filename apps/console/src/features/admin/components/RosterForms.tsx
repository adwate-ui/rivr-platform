import { zodResolver } from '@hookform/resolvers/zod';
import { rosterShiftsSchema } from '@rivr/contracts';
import { useVenueStaff, type StaffMember } from '@rivr/db';
import { useRosterActions, type RosterFailure } from '@rivr/db/roster';
import { dayAfter } from '@rivr/domain/clubDay';
import { formatDayMonth, formatNumber, formatWeekday, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text, LoadState } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { ROSTER_FAILURE_COPY } from './rosterCopy.ts';
import { noonOf } from './rosterRows.ts';

type ShiftsForm = UseFormReturn<z.input<typeof rosterShiftsSchema>, unknown, z.output<typeof rosterShiftsSchema>>;

/** The club's usual evening shift, offered until the keeper changes it. */
const USUAL_SHIFT = { starts: '18:00', ends: '02:00' };

/** What a roster change said: how many it changed, or why not. */
type Outcome = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly failure: RosterFailure };

function OutcomeLine({ outcome }: { outcome: Outcome | null }) {
  if (outcome === null) return null;
  return outcome.ok ? <Text>{outcome.text}</Text> : <ErrorMessage>{t(ROSTER_FAILURE_COPY[outcome.failure])}</ErrorMessage>;
}

/** A job title's chips, then which of its staff: choosing a title chooses all of them. */
function StaffField({ form, active }: { form: ShiftsForm; active: readonly StaffMember[] }) {
  const [title, setTitle] = useState<string | null>(null);
  const titles = [...new Set(active.map((member) => member.jobTitle))].sort();
  const choose = (picked: string | undefined) => {
    setTitle(picked ?? null);
    form.setValue('staffIds', active.filter((member) => member.jobTitle === picked).map((member) => member.staffId));
  };
  return (
    <Stack gap={2}>
      <ChoiceChips label={t('console.roster.jobTitle')} mode="one" selected={title === null ? [] : [title]} onChange={(picked) => choose(picked[0])}
        options={titles.map((value) => ({ value, label: value }))} />
      {title === null ? null : <Controller control={form.control} name="staffIds" render={({ field }) => (
        <ChoiceChips label={t('console.roster.staff')} mode="many" selected={field.value} onChange={field.onChange}
          options={active.filter((member) => member.jobTitle === title).map((member) => ({ value: member.staffId, label: member.fullName }))} />
      )} />}
      {form.formState.errors.staffIds ? <ErrorMessage>{t('console.roster.invalidStaff')}</ErrorMessage> : null}
    </Stack>
  );
}

/** The days of the week shown, as chips. */
function DaysField({ form, days }: { form: ShiftsForm; days: readonly string[] }) {
  return (
    <Stack gap={2}>
      <Controller control={form.control} name="days" render={({ field }) => (
        <ChoiceChips label={t('console.roster.days')} mode="many" selected={field.value} onChange={field.onChange}
          options={days.map((day) => ({ value: day, label: t('console.roster.day', { weekday: formatWeekday(noonOf(day)), day: formatDayMonth(noonOf(day)) }) }))} />
      )} />
      {form.formState.errors.days ? <ErrorMessage>{t('console.roster.invalidDays')}</ErrorMessage> : null}
    </Stack>
  );
}

/** Shifts for some staff of a job title on the days chosen of the week shown, from a start to an end. */
function ShiftsFields({ venueId, days, active }: { venueId: string; days: readonly string[]; active: readonly StaffMember[] }) {
  const { add } = useRosterActions(venueId);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [resolver] = useState(() => zodResolver(rosterShiftsSchema));
  const form: ShiftsForm = useForm({ resolver, defaultValues: { staffIds: [], days: [], ...USUAL_SHIFT } });
  const submit = form.handleSubmit(async (shifts) => {
    const done = await add.mutateAsync(shifts);
    setOutcome(done.ok ? { ok: true, text: t('console.roster.added', { count: formatNumber(done.value) }) } : { ok: false, failure: done.error });
  });
  const errors = form.formState.errors;
  const invalidTime = t('console.roster.invalidTime');
  const startsField = form.register('starts');
  const endsField = form.register('ends');
  return (
    <Stack gap={4} align="start">
      <StaffField form={form} active={active} />
      <DaysField form={form} days={days} />
      <Input {...startsField} label={t('console.roster.starts')} hint={t('console.roster.startsHint')} autoComplete="off"
        error={errors.starts ? invalidTime : undefined} />
      <Input {...endsField} label={t('console.roster.ends')} hint={t('console.roster.endsHint')} autoComplete="off"
        error={errors.ends ? invalidTime : undefined} />
      <OutcomeLine outcome={outcome} />
      <Button variant="primary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.roster.add')}</Button>
    </Stack>
  );
}

/** Adding shifts, once the venue's active staff are known. */
export function AddShiftsForm({ venueId, days }: { venueId: string; days: readonly string[] }) {
  const staff = useVenueStaff(venueId);
  const active = (staff.data ?? []).filter((member) => member.isActive);
  const body = staff.data === undefined ? (
    <Stack gap={2} align="start">
      <LoadState isError={staff.isError} onRetry={() => void staff.refetch()} />
    </Stack>
  ) : active.length === 0 ? <Text tone="muted">{t('console.roster.noStaff')}</Text> : <ShiftsFields venueId={venueId} days={days} active={active} />;
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.roster.addTitle')}</Heading>
      {body}
    </Stack>
  );
}

/** Copies the week before into the week shown, but for shifts that would overlap. */
export function CopyWeekButton({ venueId, week }: { venueId: string; week: string }) {
  const { copyWeek } = useRosterActions(venueId);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const copy = async () => {
    const done = await copyWeek.mutateAsync({ from: dayAfter(week, -7), to: week });
    setOutcome(done.ok ? { ok: true, text: t('console.roster.copied', { count: formatNumber(done.value) }) } : { ok: false, failure: done.error });
  };
  return (
    <Stack gap={2} align="start">
      <Button isLoading={copyWeek.isPending} onClick={() => void copy()}>{t('console.roster.copy')}</Button>
      <OutcomeLine outcome={outcome} />
    </Stack>
  );
}
