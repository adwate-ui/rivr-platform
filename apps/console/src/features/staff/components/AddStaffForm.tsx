import { zodResolver } from '@hookform/resolvers/zod';
import { staffAddSchema, type StaffRole } from '@rivr/contracts';
import { useStaffActions, type StaffFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import type { z } from 'zod';
import { roleName, STAFF_FAILURE_COPY } from './staffCopy.ts';

type StaffForm = z.input<typeof staffAddSchema>;
type StaffFormControl = Control<StaffForm, unknown, z.output<typeof staffAddSchema>>;

/** The new staff member's role: only the roles the manager may give are offered. */
function RoleField({ control, grantable, isInvalid }: { control: StaffFormControl; grantable: readonly StaffRole[]; isInvalid: boolean }) {
  return (
    <Stack gap={1}>
      <Controller control={control} name="role" render={({ field }) => (
        <ChoiceChips label={t('console.staff.role')} mode="one" selected={field.value === undefined ? [] : [field.value]}
          options={grantable.map((value) => ({ value, label: roleName(value) }))}
          onChange={(roles) => { if (roles[0] !== undefined) field.onChange(roles[0]); }} />
      )} />
      <Text variant="small" tone="muted">{t('console.staff.roleHint')}</Text>
      {isInvalid ? <ErrorMessage>{t('console.staff.invalidRole')}</ErrorMessage> : null}
    </Stack>
  );
}

/** Adds a staff member: name, job title, a role the manager may give, and the number they sign in with. */
export function AddStaffForm({ venueId, grantable }: { venueId: string; grantable: readonly StaffRole[] }) {
  const { add } = useStaffActions(venueId);
  const [failure, setFailure] = useState<StaffFailure | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [resolver] = useState(() => zodResolver(staffAddSchema));
  const form = useForm<StaffForm, unknown, z.output<typeof staffAddSchema>>({
    resolver, defaultValues: { fullName: '', jobTitle: '', phone: '' },
  });
  const submit = form.handleSubmit(async (staff) => {
    const result = await add.mutateAsync(staff);
    setFailure(result.ok ? null : result.error);
    setAdded(result.ok ? staff.fullName : null);
    if (result.ok) form.reset();
  });
  const errors = form.formState.errors;
  const fullNameField = form.register('fullName');
  const jobTitleField = form.register('jobTitle');
  const phoneField = form.register('phone');
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.staff.addTitle')}</Heading>
      <Input {...fullNameField} label={t('console.staff.fullName')} autoComplete="off" error={errors.fullName ? t('console.staff.invalidName') : undefined} />
      <Input {...jobTitleField} label={t('console.staff.jobTitle')} hint={t('console.staff.jobTitleHint')} autoComplete="off"
        error={errors.jobTitle ? t('console.staff.invalidJobTitle') : undefined} />
      <RoleField control={form.control} grantable={grantable} isInvalid={errors.role !== undefined} />
      <Input {...phoneField} type="tel" inputMode="numeric" prefix="+91" label={t('console.staff.phone')} hint={t('console.staff.phoneHint')}
        autoComplete="off" error={errors.phone ? t('console.staff.invalidPhone') : undefined} />
      <Button isLoading={add.isPending} onClick={() => void submit()}>{t('console.staff.add')}</Button>
      <StatusMessage>{added === null ? null : t('console.staff.added', { name: added })}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(STAFF_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
