import { zodResolver } from '@hookform/resolvers/zod';
import { staffJobTitleSchema, type StaffRole } from '@rivr/contracts';
import { useStaffActions, type StaffChange, type StaffFailure, type StaffMember } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Button, ChoiceChips, ConfirmQuestion, ErrorMessage, Inline, Input, Stack, Switch, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { OnboardingChecklist } from './OnboardingChecklist.tsx';
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

/** Who they are: name (and You on one's own row), job title and role, their number, and whether their login is off. */
function StaffIdentity({ member, showsInactive }: { member: StaffMember; showsInactive: boolean }) {
  return (
    <Stack gap={1}>
      <Text weight="semibold">{member.isMe ? `${member.fullName} · ${t('console.staff.you')}` : member.fullName}</Text>
      <Text variant="small" tone="muted">{t('console.staff.line', { jobTitle: member.jobTitle, role: roleName(member.role) })}</Text>
      <Text variant="small" tone="muted">{member.phone === null ? t('console.staff.noPhone') : formatMobile(member.phone)}</Text>
      {member.isActive || !showsInactive ? null : <Text variant="small" weight="medium">{t('console.staff.inactive')}</Text>}
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
 * What the manager may change on a row. Someone in a role the manager couldn't give is out of their reach (the line above
 * names the role); their own job title is theirs to change whatever their role (B3: an admin no longer gives the admin role).
 */
function reachOf(member: StaffMember, grantable: readonly StaffRole[], isPending: boolean) {
  const isInReach = grantable.includes(member.role);
  return { isInReach, canChange: isInReach && !isPending, canRetitle: (isInReach || member.isMe) && !isPending };
}

/** The question and its Yes, for a role or an active change asked on a row. */
function askCopy(asked: StaffChange, name: string): { question: string; confirm: string } {
  if ('role' in asked) return { question: t('console.staff.askRole', { name, role: roleName(asked.role) }), confirm: t('console.staff.confirmRole') };
  if ('isActive' in asked && asked.isActive) return { question: t('console.staff.askTurnOn', { name }), confirm: t('console.staff.confirmTurnOn') };
  return { question: t('console.staff.askTurnOff', { name }), confirm: t('console.staff.confirmTurnOff') };
}

interface RowChangesProps {
  member: StaffMember;
  grantable: readonly StaffRole[];
  isInReach: boolean;
  canChange: boolean;
  isSaving: boolean;
  onSave: (change: StaffChange) => Promise<void>;
}

/** The role and whether they're active, each picked on the row, shown, and asked before it is saved (F1-09). */
function RowChanges({ member, grantable, isInReach, canChange, isSaving, onSave }: RowChangesProps) {
  const [asked, setAsked] = useState<StaffChange | null>(null);
  const name = member.fullName;
  const role = asked !== null && 'role' in asked ? asked.role : member.role;
  const isActive = asked !== null && 'isActive' in asked ? asked.isActive : member.isActive;
  const isLocked = !canChange || member.isMe;
  return (
    <>
      {isInReach ? (
        <ChoiceChips label={t('console.staff.roleFor', { name })} mode="one" selected={[role]} isDisabled={isLocked}
          options={grantable.map((option) => ({ value: option, label: roleName(option) }))}
          onChange={([picked]) => { if (picked !== undefined) setAsked(picked === member.role ? null : { role: picked }); }} />
      ) : null}
      <Switch label={t('console.staff.activeFor', { name })} {...(member.isActive ? {} : { hint: t('console.staff.inactive') })} isOn={isActive}
        isDisabled={isLocked} onChange={(on) => setAsked(on === member.isActive ? null : { isActive: on })} />
      {asked === null ? null : (
        <ConfirmQuestion {...askCopy(asked, name)} isBusy={isSaving} onConfirm={() => void onSave(asked).then(() => setAsked(null))}
          onCancel={() => setAsked(null)} />
      )}
    </>
  );
}

/**
 * One staff member on one row: name, job title and role, their number, and Change, which opens what the manager may change
 * in place (UI polish audit A-17). A manager changes only someone whose role they could give, and never their own role or
 * whether they're active; their own job title is theirs to change.
 */
export function StaffRow({ venueId, member, grantable }: StaffRowProps) {
  const { change } = useStaffActions(venueId);
  const [isChanging, setIsChanging] = useState(false);
  const [failure, setFailure] = useState<StaffFailure | null>(null);
  const [isTitleSaved, setIsTitleSaved] = useState(false);
  const save = async (update: StaffChange) => {
    const result = await change.mutateAsync({ staffId: member.staffId, change: update });
    setFailure(result.ok ? null : result.error);
    setIsTitleSaved(result.ok && 'jobTitle' in update);
  };
  const { isInReach, canChange, canRetitle } = reachOf(member, grantable, change.isPending);
  return (
    <Stack gap={3}>
      <Inline justify="between" align="center" gap={4}>
        {/* Open, the row's switch says whether the login is off. */}
        <StaffIdentity member={member} showsInactive={!isChanging} />
        {(isInReach || member.isMe) && !isChanging ? (
          <Button variant="text" aria-label={t('console.staff.changeFor', { name: member.fullName })} onClick={() => setIsChanging(true)}>
            {t('console.staff.change')}
          </Button>
        ) : null}
      </Inline>
      {isChanging ? (
        <Stack gap={3}>
          <JobTitleForm member={member} isDisabled={!canRetitle} onSave={(jobTitle) => save({ jobTitle })} />
          <StatusMessage>{isTitleSaved ? t('console.staff.jobTitleSaved') : null}</StatusMessage>
          <RowChanges member={member} grantable={grantable} isInReach={isInReach} canChange={canChange} isSaving={change.isPending} onSave={save} />
          {member.isMe ? <Text variant="small" tone="muted">{t('console.staff.ownRow')}</Text> : null}
          <Inline><Button variant="text" onClick={() => { setIsChanging(false); setFailure(null); }}>{t('console.staff.done')}</Button></Inline>
        </Stack>
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(STAFF_FAILURE_COPY[failure])}</ErrorMessage>}
      {/* A hire turned off has no checklist. */}
      {member.isActive ? <OnboardingChecklist venueId={venueId} member={member} /> : null}
    </Stack>
  );
}
