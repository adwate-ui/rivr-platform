import { useTableTypeRake } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, LoadState, Stack, Text } from '@rivr/ui';
import { RakeChangeForm } from './RakeChangeForm.tsx';
import { TableTypeRakeRow } from './TableTypeRakeRow.tsx';

/**
 * Each table type's rake (#37, scope-v1 module 3), at the top of Settings' Rake area (#604): the rule now and the
 * changes to come, and a change scheduled from a time. Hands keep the rule in force when they were played, so a change
 * never reaches back.
 */
export function RakeSection({ venueId }: { venueId: string }) {
  const rake = useTableTypeRake(venueId);
  const types = rake.data;
  return (
    <Stack gap={6}>
      <Heading level={2}>{t('console.rake.title')}</Heading>
      {types === undefined ? <LoadState isError={rake.isError} onRetry={() => void rake.refetch()} /> : null}
      {types?.length === 0 ? <Text tone="muted">{t('console.rake.empty')}</Text> : null}
      {types !== undefined && types.length > 0 ? (
        <Stack gap={10}>
          <Stack gap={6} divided>
            {types.map((type) => <TableTypeRakeRow key={type.tableTypeId} venueId={venueId} type={type} />)}
          </Stack>
          <RakeChangeForm venueId={venueId} tableTypes={types} />
        </Stack>
      ) : null}
    </Stack>
  );
}
