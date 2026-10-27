import { useOnboardingChecklist, type OnboardingItem, type StaffMember } from '@rivr/db';
import { formatDate, formatTime, t } from '@rivr/i18n';
import { Button, DataTable, Inline, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

function columns(): readonly DataTableColumn<OnboardingItem>[] {
  return [
    { key: 'sop', header: t('console.staff.onboarding.sop'), cell: (item) => item.title, sortValue: (item) => item.title },
    { key: 'version', header: t('console.staff.onboarding.version'), cell: (item) => item.version, sortValue: (item) => item.version, align: 'end' },
    {
      key: 'at', header: t('console.staff.onboarding.acknowledged'), sortValue: (item) => item.acknowledgedAt ?? '',
      cell: (item) => (item.acknowledgedAt === null
        ? <Text tone="muted">{t('console.staff.onboarding.notYet')}</Text>
        : `${formatDate(new Date(item.acknowledgedAt))}, ${formatTime(new Date(item.acknowledgedAt))}`),
    },
  ];
}

/** The checklist's items, or the table's loading or error state. */
function ChecklistTable({ venueId, member }: { venueId: string; member: StaffMember }) {
  const checklist = useOnboardingChecklist(venueId, member.staffId);
  const base = { label: t('console.staff.onboarding.show', { name: member.fullName }), columns: columns(), rowKey: (item: OnboardingItem) => item.sopId };
  if (checklist.data === undefined && checklist.isError) return <DataTable {...base} status="error" onRetry={() => void checklist.refetch()} />;
  if (checklist.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={checklist.data} emptyText={t('console.staff.onboarding.none')} />;
}

/** How many of the hire's SOPs they have acknowledged; nothing until the checklists have loaded. */
function Progress({ items }: { items: readonly OnboardingItem[] | undefined }) {
  if (items === undefined) return null;
  const count = items.filter((item) => item.acknowledgedAt !== null).length;
  return <Text variant="small">{t('console.staff.onboarding.progress', { count, total: items.length })}</Text>;
}

/**
 * A hire's onboarding checklist (#107; scope-v1 module 10): each SOP in force that asks their role, ticked
 * once they acknowledge that version. A new version reopens its item until they acknowledge it (question #483).
 */
export function OnboardingChecklist({ venueId, member }: { venueId: string; member: StaffMember }) {
  const checklist = useOnboardingChecklist(venueId, member.staffId);
  const [isOpen, setIsOpen] = useState(false);
  const name = member.fullName;
  // Nothing to open: say so once, rather than again inside an empty table.
  if (checklist.data?.length === 0) return <Text variant="small" tone="muted">{t('console.staff.onboarding.none')}</Text>;
  return (
    <Stack gap={2}>
      <Progress items={checklist.data} />
      <Inline>
        <Button variant="text" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? t('console.staff.onboarding.hide', { name }) : t('console.staff.onboarding.show', { name })}
        </Button>
      </Inline>
      {isOpen ? <ChecklistTable venueId={venueId} member={member} /> : null}
    </Stack>
  );
}
