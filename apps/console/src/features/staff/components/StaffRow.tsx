import { zodResolver } from '@hookform/resolvers/zod';
import { staffJobTitleSchema, type StaffRole } from '@rivr/contracts';
import { useStaffActions, type StaffChange, type StaffFailure, type StaffMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { roleName, STAFF_FAILURE_COPY } from './staffCopy.ts';

/** The job title, changed on its own. */
function JobTitleForm({ member, isDisabled, onSave }: { member: StaffMember; isDisabled: boolean; onSave: (jobTitle: string) => Promise<void> }) {
  const [resolver] = useState(() => zodResolver(staffJobTitleSchema));
  const form = useForm<z.input<typeof staffJobTitleSchema>, unknown, z.output<typeof staffJobTitleSchema>>({
    resolver, defaultValues: { jobTitle: member.jobTitle },
  });
  const submit = form.handleSubmit(({ jobTitle }) => onSave(jobTitle));
  const jobTitleField = form.register('jobTitle');
  return (
    <Inline gap={3} align="end">
      <Input {...jobTitleField} label={t('console.staff.jobTitleFor', { name: member.fullName })} autoComplete="off" disabled={isDisabled}
        error={form.formState.errors.jobTitle ? t('console.staff.invalidJobTitle') : undefined} />
      <Button variant="secondary" isDisabled={isDisabled} onClick={() => void submit()}>{t('console.staff.saveJobTitle', { name: member.fullName })}</Button>
    </Inline>
  );
}

/** Who they are: name (and You on one's own row), job title and role, and their number. */
function StaffIdentity({ member }: { member: StaffMember }) {
  return (
    <Stack gap={1}>
      <Text weight="semibold">{member.isMe ? `${member.fullName} · ${t('console.staff.you')}` : member.fullName}</Text>
      <Text variant="small" tone="muted">{t('console.staff.line', { jobTitle: member.jobTitle, role: roleName(member.role) })}</Text>
      <Text variant="small" tone="muted">{member.phone ?? t('console.staff.noPhone')}</Text>
    </Stack>
  );
}

interface StaffRowProps {
  venueId: string;
  member: StaffMember;
  /** The roles the signed-in manager may give: a member in any other role is out of their reach. */
  grantable: readonly StaffRole[];
}

/**
 * One staff member: name, job title and role, their number, and the changes the manager may make. A
 * manager changes only someone whose role they could give, and never their own role or whether they're active.
 */
export function StaffRow({ venueId, member, grantable }: StaffRowProps) {
  const { change } = useStaffActions(venueId);
  const [failure, setFailure] = useState<StaffFailure | null>(null);
  const [isTitleSaved, setIsTitleSaved] = useState(false);
  const save = async (update: StaffChange) => {
    const result = await change.mutateAsync({ staffId: member.staffId, change: update });
    setFailure(result.ok ? null : result.error);
    setIsTitleSaved(result.ok && 'jobTitle' in update);
  };
  // Someone in a role the manager couldn't give is out of their reach: the line above names the role.
  const isInReach = grantable.includes(member.role);
  const canChange = isInReach && !change.isPending;
  const name = member.fullName;
  return (
    <Stack gap={3}>
      <StaffIdentity member={member} />
      <JobTitleForm member={member} isDisabled={!canChange} onSave={(jobTitle) => save({ jobTitle })} />
      {isTitleSaved ? <Text variant="small">{t('console.staff.jobTitleSaved')}</Text> : null}
      {isInReach ? (
        <ChoiceChips label={t('console.staff.roleFor', { name })} mode="one" selected={[member.role]} isDisabled={!canChange || member.isMe}
          options={grantable.map((role) => ({ value: role, label: roleName(role) }))}
          onChange={(roles) => { if (roles[0] !== undefined) void save({ role: roles[0] }); }} />
      ) : null}
      <Switch label={t('console.staff.activeFor', { name })} {...(member.isActive ? {} : { hint: t('console.staff.inactive') })} isOn={member.isActive}
        isDisabled={!canChange || member.isMe} onChange={(isActive) => void save({ isActive })} />
      {member.isMe ? <Text variant="small" tone="muted">{t('console.staff.ownRow')}</Text> : null}
      {failure === null ? null : <ErrorMessage>{t(STAFF_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
