import type { StaffRole } from '@rivr/contracts';
import { STAFF_ROLES } from '@rivr/contracts/roles';
import { useStaffActions, useStaffRemovals, type StaffMember, type StaffRemoval } from '@rivr/db';
import { formatDate, formatMobile, t } from '@rivr/i18n';
import { Button, ChoiceChips, ConfirmButton, DataTable, Grid, Inline, Stack, Text, useToast, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { AddStaffForm } from './AddStaffForm.tsx';
import { roleName } from './staffCopy.ts';
import { StaffRow } from './StaffRow.tsx';

/** The table's columns: name (You on one's own), job title, role, the number they sign in with, and whether the login is on. */
function columns(): readonly DataTableColumn<StaffMember>[] {
  return [
    {
      key: 'name', header: t('console.staff.name'), sortValue: (row) => row.fullName,
      cell: (row) => (row.isMe ? `${row.fullName} · ${t('console.staff.you')}` : row.fullName),
    },
    { key: 'jobTitle', header: t('console.staff.jobTitle'), cell: (row) => row.jobTitle, sortValue: (row) => row.jobTitle },
    { key: 'role', header: t('console.staff.role'), cell: (row) => roleName(row.role), sortValue: (row) => roleName(row.role) },
    {
      key: 'phone', header: t('console.staff.phone'), priority: 'secondary',
      cell: (row) => (row.phone === null ? <Text tone="muted">{t('console.staff.noPhone')}</Text> : formatMobile(row.phone)),
      exportValue: (row) => row.phone ?? '',
    },
    {
      key: 'login', header: t('console.staff.login'), sortValue: (row) => (row.isActive ? 0 : 1),
      cell: (row) => (row.isActive ? t('console.staff.active') : t('console.staff.inactive')),
    },
  ];
}

/** When a removed login was turned off, and by whom: `5 Nov 2026 · by Vikram Rao`. */
function removedLine(removal: StaffRemoval | undefined): string {
  if (removal === undefined) return '';
  const date = formatDate(new Date(removal.removedAt));
  return removal.removedBy === null ? date : t('console.staff.removedBy', { date, name: removal.removedBy });
}

/** Removed staff (owner, 8 Nov): name, job title and role, when they were removed and by whom, and Restore. */
function removedColumns(removals: ReadonlyMap<string, StaffRemoval>, onRestore: (member: StaffMember) => void): readonly DataTableColumn<StaffMember>[] {
  const [name, jobTitle, role] = columns();
  return [
    ...[name, jobTitle, role].filter((column) => column !== undefined),
    {
      key: 'removed', header: t('console.staff.removedOn'), cell: (row) => removedLine(removals.get(row.staffId)),
      sortValue: (row) => removals.get(row.staffId)?.removedAt ?? '', exportValue: (row) => removedLine(removals.get(row.staffId)),
    },
    {
      key: 'restore', header: t('console.staff.restore'),
      cell: (row) => (
        <ConfirmButton label={t('console.staff.restore')} name={t('console.staff.restoreNamed', { name: row.fullName })}
          confirm={t('console.staff.confirmRestore', { name: row.fullName })} variant="subtle" size="small" onConfirm={() => onRestore(row)} />
      ),
    },
  ];
}

/** What the search box looks through: name, job title, role and number, as kept and as shown. */
function searchText(member: StaffMember): string {
  const phone = member.phone === null ? [] : [member.phone, formatMobile(member.phone)];
  return [member.fullName, member.jobTitle, roleName(member.role), ...phone].join(' ');
}

const ALL = 'all';

/** The role chips (console v3): All, then each role someone holds, in the roles' order, each with how many hold it. */
function RoleFilter({ members, role, onChange }: { members: readonly StaffMember[]; role: string; onChange: (role: string) => void }) {
  const held = STAFF_ROLES.filter((one) => members.some((member) => member.role === one));
  const options = [
    { value: ALL, label: t('console.staff.allRoles'), count: members.length },
    ...held.map((one) => ({ value: one, label: roleName(one), count: members.filter((member) => member.role === one).length })),
  ];
  return (
    <ChoiceChips label={t('console.staff.roleFilter')} isLabelVisuallyHidden mode="one" look="subtle" selected={[role]} options={options}
      onChange={(chosen) => onChange(chosen[0] ?? ALL)} />
  );
}

interface StaffTableProps {
  venueId: string;
  members: readonly StaffMember[];
  /** The roles the signed-in manager may give. */
  grantable: readonly StaffRole[];
  /** Add staff, in the screen's header (console v3), opens the form above the table. */
  isAdding: boolean;
}

/** Restore: the login turned on again, with a toast when it does not go through. */
function useRestore(venueId: string) {
  const { change } = useStaffActions(venueId);
  const toast = useToast();
  return (member: StaffMember) => void change.mutateAsync({ staffId: member.staffId, change: { isActive: true } })
    .then((done) => { if (!done.ok) toast(t('console.staff.restoreFailed')); });
}

/**
 * The venue's staff as a table to search and narrow by role (C-03, console v3), active and removed apart (owner, 8 Nov):
 * a name opens that person's row beside the table, to change them or see their onboarding; Add staff opens the form above.
 */
export function StaffTable({ venueId, members, grantable, isAdding }: StaffTableProps) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [role, setRole] = useState<string>(ALL);
  const [view, setView] = useState<'active' | 'removed'>('active');
  const removals = useStaffRemovals(venueId).data ?? new Map<string, StaffRemoval>();
  const restore = useRestore(venueId);
  const inView = members.filter((member) => member.isActive === (view === 'active'));
  const chosen = inView.find((member) => member.staffId === chosenId) ?? null;
  const shown = role === ALL ? inView : inView.filter((member) => member.role === role);
  const removedCount = members.length - members.filter((member) => member.isActive).length;
  return (
    <Stack gap={8}>
      {isAdding ? <AddStaffForm venueId={venueId} grantable={grantable} /> : null}
      <ChoiceChips label={t('console.staff.views.label')} isLabelVisuallyHidden mode="one" look="tabs" selected={[view]}
        options={[{ value: 'active', label: t('console.staff.views.active'), count: members.length - removedCount },
          { value: 'removed', label: t('console.staff.views.removed'), count: removedCount }]}
        onChange={([chosenView]) => { setView(chosenView === 'removed' ? 'removed' : 'active'); setRole(ALL); setChosenId(null); }} />
      <RoleFilter members={inView} role={role} onChange={setRole} />
      {/* The table full width until someone is opened, as on Members; in place, so the search typed stays. */}
      <Grid columns={chosen === null ? 1 : 2} gap={8} stackBelow="medium">
        <DataTable label={t('console.staff.tabs.staff')} narrowLayout="scroll" rows={shown} rowKey={(row) => row.staffId}
          columns={view === 'active' ? columns() : removedColumns(removals, restore)}
          emptyText={view === 'active' ? t('console.staff.empty') : t('console.staff.noneRemoved')} filter={{ label: t('console.staff.search'), text: searchText }} onRowOpen={(row) => setChosenId(row.staffId)} />
        {chosen === null ? null : (
          <Stack gap={4}>
            <StaffRow key={chosen.staffId} venueId={venueId} member={chosen} grantable={grantable} />
            <Inline>
              <Button variant="text" aria-label={t('console.staff.closeFor', { name: chosen.fullName })} onClick={() => setChosenId(null)}>
                {t('common.close')}
              </Button>
            </Inline>
          </Stack>
        )}
      </Grid>
    </Stack>
  );
}
