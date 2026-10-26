import type { BlindStructure } from '@rivr/db';
import { levelCount, structureMinutes } from '@rivr/domain/tournament';
import { formatDuration, t } from '@rivr/i18n';
import { Button, DataTable, Grid, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { StructureEditor } from './StructureEditor.tsx';

function structureColumns(onEdit: (structure: BlindStructure) => void): DataTableColumn<BlindStructure>[] {
  return [
    { key: 'name', header: t('console.tournaments.name'), cell: (row) => row.name },
    { key: 'levels', header: t('console.tournaments.levelsColumn'), align: 'end', cell: (row) => String(levelCount(row.stages)) },
    { key: 'length', header: t('console.tournaments.lengthColumn'), align: 'end', cell: (row) => formatDuration(structureMinutes(row.stages) * 60) },
    {
      key: 'edit', header: t('console.tournaments.edit'), align: 'end',
      cell: (row) => (
        <Button variant="text" aria-label={t('console.tournaments.editName', { name: row.name })} onClick={() => onEdit(row)}>{t('console.tournaments.edit')}</Button>
      ),
    },
  ];
}

/** The venue's blind structures (#115), and the editor for a new one or the one chosen. */
export function StructuresView({ venueId, structures }: { venueId: string; structures: readonly BlindStructure[] }) {
  const [editing, setEditing] = useState<BlindStructure | null>(null);
  return (
    <Grid columns={2} gap={12}>
      <DataTable label={t('console.tournaments.structures')} columns={structureColumns(setEditing)} rowKey={(row) => row.id} rows={structures}
        emptyText={t('console.tournaments.noStructureList')} />
      <StructureEditor key={editing?.id ?? 'new'} venueId={venueId} structure={editing} onDone={() => setEditing(null)} />
    </Grid>
  );
}
