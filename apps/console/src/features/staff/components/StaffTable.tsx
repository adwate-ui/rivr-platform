import type { StaffRole } from '@rivr/contracts';
import { STAFF_ROLES } from '@rivr/contracts/roles';
import type { StaffMember } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, Grid, Inline, Stack, Text, type DataTableColumn } from '@rivr/ui';
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
    <ChoiceChips label={t('console.staff.role')} isLabelVisuallyHidden mode="one" look="subtle" selected={[role]} options={options}
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

/**
 * The venue's staff as a table to search and narrow by role (C-03, console v3): a name opens that person's row beside
 * the table, to change them or see their onboarding; Add staff opens the form above it.
 */
export function StaffTable({ venueId, members, grantable, isAdding }: StaffTableProps) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [role, setRole] = useState<string>(ALL);
  const chosen = members.find((member) => member.staffId === chosenId) ?? null;
  const shown = role === ALL ? members : members.filter((member) => member.role === role);
  return (
    <Stack gap={8}>
      {isAdding ? <AddStaffForm venueId={venueId} grantable={grantable} /> : null}
      {/* The table full width until someone is opened, as on Members; in place, so the search typed stays. */}
      <Grid columns={chosen === null ? 1 : 2} gap={8} stackBelow="medium">
        <DataTable label={t('console.staff.tabs.staff')} columns={columns()} rows={shown} rowKey={(row) => row.staffId}
          emptyText={t('console.staff.empty')} filter={{ label: t('console.staff.search'), text: searchText }}
          toolbar={() => <RoleFilter members={members} role={role} onChange={setRole} />} onRowOpen={(row) => setChosenId(row.staffId)} />
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
