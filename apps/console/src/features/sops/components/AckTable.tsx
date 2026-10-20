import { useSopAcknowledgements, type SopAcknowledgement } from '@rivr/db';
import { formatDate, formatTime, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { roleName } from './sopCopy.ts';

function columns(): readonly DataTableColumn<SopAcknowledgement>[] {
  return [
    { key: 'name', header: t('console.sops.name'), cell: (row) => row.fullName, sortValue: (row) => row.fullName },
    { key: 'role', header: t('console.sops.role'), cell: (row) => roleName(row.role), sortValue: (row) => roleName(row.role) },
    {
      key: 'at', header: t('console.sops.acknowledgedAt'), sortValue: (row) => row.acknowledgedAt ?? '',
      cell: (row) => (row.acknowledgedAt === null
        ? <Text tone="muted">{t('console.sops.notYet')}</Text>
        : `${formatDate(new Date(row.acknowledgedAt))}, ${formatTime(new Date(row.acknowledgedAt))}`),
    },
  ];
}

/** The rows, or the table's loading or error state. */
function AckRows({ versionId }: { versionId: string }) {
  const acks = useSopAcknowledgements(versionId);
  const base = { label: t('console.sops.acknowledgements'), columns: columns(), rowKey: (row: SopAcknowledgement) => row.staffId };
  if (acks.data === undefined && acks.isError) return <DataTable {...base} status="error" onRetry={() => void acks.refetch()} />;
  if (acks.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={acks.data} emptyText={t('console.sops.nobodyAsked')} />;
}

/** For SOP managers: the staff the version in force asks, those yet to acknowledge it first. */
export function AckTable({ versionId }: { versionId: string }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.sops.acknowledgements')}</Heading>
      <AckRows versionId={versionId} />
    </Stack>
  );
}
