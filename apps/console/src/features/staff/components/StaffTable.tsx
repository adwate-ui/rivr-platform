import type { StaffRole } from '@rivr/contracts';
import { STAFF_ROLES } from '@rivr/contracts/roles';
import { useStaffActions, useStaffRemovals, type StaffMember, type StaffRemoval } from '@rivr/db';
import { formatDate, formatMobile, t } from '@rivr/i18n';
import { Button, ChoiceChips, ConfirmButton, DataTable, Grid, Inline, Stack, Text, useToast, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { AddStaffForm } from './AddStaffForm.tsx';
import { roleName, STAFF_FAILURE_COPY } from './staffCopy.ts';
import { StaffRow } from './StaffRow.tsx';

/** Staff still working, or those whose login is turned off (owner, 8 Nov), each under its own tab. */
export type StaffView = 'active' | 'removed';

/** The table's columns: name (You on one's own), job title, role, and the number they sign in with. */
function columns(): readonly DataTableColumn<StaffMember>[] {
  return [
    {
      key: 'name', header: t('console.staff.name'), sortValue: (row) => row.fullName,
      cell: (row) => (row.isMe ? `${row.fullName} · ${t('console.staff.you')}` : row.fullName),
    },
    { key: 'jobTitle', header: t('console.staff.jobTitle'), cell: (row) => row.jobTitle, sortValue: (row) => row.jobTitle, filter: 'choice' },
    { key: 'role', header: t('console.staff.role'), cell: (row) => roleName(row.role), sortValue: (row) => roleName(row.role) },
    {
      key: 'phone', header: t('console.staff.phone'), priority: 'secondary',
      cell: (row) => (row.phone === null ? <Text tone="muted">{t('console.staff.noPhone')}</Text> : formatMobile(row.phone)),
      exportValue: (row) => row.phone ?? '',
    },
  ];
}

/** When a removed login was turned off, and by whom: `5 Nov 2026 · by Vikram Rao`; one added already off has no such record. */
function removedLine(removal: StaffRemoval | undefined): string {
  if (removal === undefined) return t('console.staff.removedUnrecorded');
  const date = formatDate(new Date(removal.removedAt));
  return removal.removedBy === null ? date : t('console.staff.removedBy', { date, name: removal.removedBy });
}

/** How Restore runs: the step, and whether one is under way, so it is never sent twice. */
interface Restore {
  readonly run: (member: StaffMember) => void;
  readonly isBusy: boolean;
}

/**
 * Removed staff (owner, 8 Nov): name, job title and role, when they were removed and by whom, and Restore for a role the
 * manager may give, as the row's own changes are.
 */
function removedColumns(removals: ReadonlyMap<string, StaffRemoval>, restore: Restore, grantable: readonly StaffRole[]): readonly DataTableColumn<StaffMember>[] {
  const [name, jobTitle, role] = columns();
  return [
    ...[name, jobTitle, role].filter((column) => column !== undefined),
    {
      key: 'removed', header: t('console.staff.removedOn'), cell: (row) => removedLine(removals.get(row.staffId)),
      sortValue: (row) => removals.get(row.staffId)?.removedAt ?? '', exportValue: (row) => removedLine(removals.get(row.staffId)),
    },
    {
      key: 'restore', filter: false, header: t('console.staff.restore'),
      cell: (row) => (!grantable.includes(row.role) ? null : (
        <ConfirmButton label={t('console.staff.restore')} name={t('console.staff.restoreNamed', { name: row.fullName })} isBusy={restore.isBusy}
          confirm={t('console.staff.confirmRestore', { name: row.fullName })} variant="subtle" size="small" onConfirm={() => restore.run(row)} />
      )),
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

/** Restore: the login turned on again, with a toast in the Staff screen's words when it does not go through. */
function useRestore(venueId: string): Restore {
  const { change } = useStaffActions(venueId);
  const toast = useToast();
  const run = (member: StaffMember) => void change.mutateAsync({ staffId: member.staffId, change: { isActive: true } })
    .then((done) => { if (!done.ok) toast(t(STAFF_FAILURE_COPY[done.error])); });
  return { run, isBusy: change.isPending };
}

/** The removed staff's table: when and by whom each was removed, read from the audit log, with its loading and error states. */
interface RemovedTableProps {
  venueId: string;
  rows: readonly StaffMember[];
  grantable: readonly StaffRole[];
  onRowOpen: (row: StaffMember) => void;
}

function RemovedTable({ venueId, rows, grantable, onRowOpen }: RemovedTableProps) {
  const removals = useStaffRemovals(venueId);
  const restore = useRestore(venueId);
  const base = {
    label: t('console.staff.tabs.removed'), narrowLayout: 'scroll' as const, rowKey: (row: StaffMember) => row.staffId, onRowOpen,
    columns: removedColumns(removals.data ?? new Map<string, StaffRemoval>(), restore, grantable),
    filter: { label: t('console.staff.search'), text: searchText },
  };
  if (removals.isError) return <DataTable {...base} status="error" onRetry={() => void removals.refetch()} />;
  if (removals.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={rows} emptyText={t('console.staff.noneRemoved')} />;
}

interface StaffTableProps {
  venueId: string;
  members: readonly StaffMember[];
  /** The roles the signed-in manager may give. */
  grantable: readonly StaffRole[];
  /** Add staff, in the screen's header (console v3), opens the form above the table. */
  isAdding: boolean;
  view: StaffView;
}

/**
 * The venue's staff as a table to search and narrow by role (C-03, console v3): those working, or under Removed staff those
 * whose login is off (owner, 8 Nov). A name opens that person's row beside the table, to change them or see their
 * onboarding; Add staff opens the form above it.
 */
export function StaffTable({ venueId, members, grantable, isAdding, view }: StaffTableProps) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [role, setRole] = useState<string>(ALL);
  const inView = members.filter((member) => member.isActive === (view === 'active'));
  const chosen = inView.find((member) => member.staffId === chosenId) ?? null;
  const shown = role === ALL ? inView : inView.filter((member) => member.role === role);
  const open = (row: StaffMember) => setChosenId(row.staffId);
  return (
    <Stack gap={8}>
      {isAdding ? <AddStaffForm venueId={venueId} grantable={grantable} /> : null}
      <RoleFilter members={inView} role={role} onChange={setRole} />
      {/* The table full width until someone is opened, as on Members; in place, so the search typed stays. */}
      <Grid columns={chosen === null ? 1 : 2} gap={8} stackBelow="medium">
        {view === 'active' ? (
          <DataTable label={t('console.staff.tabs.staff')} narrowLayout="scroll" rows={shown} rowKey={(row) => row.staffId} columns={columns()}
            emptyText={t('console.staff.empty')} filter={{ label: t('console.staff.search'), text: searchText }} onRowOpen={open} />
        ) : <RemovedTable venueId={venueId} rows={shown} grantable={grantable} onRowOpen={open} />}
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
