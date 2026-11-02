import type { StaffRole } from '@rivr/contracts';
import type { StaffMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, DataTable, Grid, Inline, Stack, Text, type DataTableColumn } from '@rivr/ui';
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
      cell: (row) => row.phone ?? <Text tone="muted">{t('console.staff.noPhone')}</Text>, exportValue: (row) => row.phone ?? '',
    },
    {
      key: 'login', header: t('console.staff.login'), sortValue: (row) => (row.isActive ? 0 : 1),
      cell: (row) => (row.isActive ? t('console.staff.active') : t('console.staff.inactive')),
    },
  ];
}

/** What the search box looks through: name, job title, role and number. */
function searchText(member: StaffMember): string {
  return [member.fullName, member.jobTitle, roleName(member.role), member.phone ?? ''].join(' ');
}

interface StaffTableProps {
  venueId: string;
  members: readonly StaffMember[];
  /** The roles the signed-in manager may give. */
  grantable: readonly StaffRole[];
}

/**
 * The venue's staff as a table to search (C-03): a name opens that person's row beside the table, to change them or see
 * their onboarding; Add staff opens the form above it, so some 40 staff no longer sit under a form.
 */
export function StaffTable({ venueId, members, grantable }: StaffTableProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = members.find((member) => member.staffId === chosenId) ?? null;
  return (
    <Stack gap={8}>
      {isAdding ? (
        <Stack gap={4}>
          <AddStaffForm venueId={venueId} grantable={grantable} />
          <Inline><Button variant="text" onClick={() => setIsAdding(false)}>{t('console.staff.close')}</Button></Inline>
        </Stack>
      ) : <Inline><Button variant="secondary" onClick={() => setIsAdding(true)}>{t('console.staff.addOpen')}</Button></Inline>}
      {/* The table full width until someone is opened, as on Members; in place, so the search typed stays. */}
      <Grid columns={chosen === null ? 1 : 2} gap={8} stackBelow="medium">
        <DataTable label={t('console.staff.tabs.staff')} columns={columns()} rows={members} rowKey={(row) => row.staffId}
          emptyText={t('console.staff.empty')} filter={{ label: t('console.staff.search'), text: searchText }}
          onRowOpen={(row) => setChosenId(row.staffId)} />
        {chosen === null ? null : (
          <Stack gap={4}>
            <StaffRow key={chosen.staffId} venueId={venueId} member={chosen} grantable={grantable} />
            <Inline>
              <Button variant="text" aria-label={t('console.staff.closeFor', { name: chosen.fullName })} onClick={() => setChosenId(null)}>
                {t('console.staff.close')}
              </Button>
            </Inline>
          </Stack>
        )}
      </Grid>
    </Stack>
  );
}
